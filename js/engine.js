/**
 * NewWorld BattleEngine/CardPlayProcessor/TurnManager의 공통 전투 규칙.
 * 미러 대전과 단일 카드 실행은 같은 파이프라인을 사용한다.
 */
import { EffectRegistry, registerCoreEffects, evaluateCondition, computeScalingValue, matchesFilter } from './effects.js';
import { getSpecialCardById } from './cards.js';
import { roundToInt, hasKeyword, cloneCard } from './battle-rules.js';
import {
    applyImmediateCore, applyCoreEffects, checkCoreTriggers,
    notifyVirusApplied, notifyVirusConsumed, notifyGambleResult
} from './core-effects.js';

const turnNumbers = [
    'selfDamageThisTurn', 'cardsPlayedThisTurn', 'skillsPlayedThisTurn', 'totalDamageThisTurn',
    'networkCardsPlayedThisTurn', 'dismantledThisTurn', 'extractEnergyRemainingCount',
    'luckyThisTurn', 'unluckyThisTurn', 'gambleSuccessThisTurn', 'gambleBonusChance',
    'buffInsuranceValue', 'buffInsuranceLuckValue', 'softenNextUnluckPenalty',
    'luckyDayLuckPerSuccess', 'luckyDayHpLossPerSuccess', 'luckyDaySuccessCount',
    'nextAttackBonus', 'nextDamageMultiplier', 'damageReductionThisTurn', 'evadeNextHits',
    'retaliateOnHitDamage', 'virusConsumedThisTurn', 'virusAppliedThisTurn',
    'virusOnCardPlayedThisTurn', 'lastHpLoss'
];
const turnFlags = [
    'extractEnergyBonusActive', 'luckyEnergyGainedThisTurn', 'retryOnUnluckFlag',
    'lastGambleUnluckSoftened', 'luckyDayDebtActive', 'armorPierceNextAttack',
    'invincibleThisTurn', 'preventNextSelfDamage'
];
function newTurnCounters() {
    return Object.fromEntries([
        ...turnNumbers.map(key => [key, 0]), ...turnFlags.map(key => [key, false])
    ]);
}

export class BattleEngine {
    constructor() {
        this.effectRegistry = new EffectRegistry();
        registerCoreEffects(this.effectRegistry);
        this.pendingDismantleTargets = [];
        this.pendingOpenAccessFilter = null;
    }

    createMirrorBattleState(deckA, deckB, config = {}) {
        const makePlayer = deck => ({
            hp: config.hp ?? 80, maxHp: config.hp ?? 80, shield: 0,
            energy: config.energy ?? 3, baseEnergy: config.energy ?? 3,
            strength: 0, weakness: 0, virus: 0, corrosion: 0,
            overclockStacks: 0, overclockMax: 4, overclockUnlimited: false,
            fixedOverclockStacks: 0, overflowNext: 0, energyDrainNext: 0,
            virusOnCardPlayedNextTurn: 0, luck: 0, luckyThisBattle: 0,
            unluckyThisBattle: 0, consecutiveLuck: 0, ignoreUnluck: false, doubleLuck: false,
            turn: newTurnCounters(), networkStacks: 0, networkCardsPlayedThisBattle: 0,
            dismantledThisBattle: 0, totalRebuildsThisBattle: 0,
            drawPile: this._shuffleArray(deck.map(cloneCard)), hand: [], voidPile: [],
            activeCores: [], rollbackStoredHand: [], baseDraw: 5, extraDraw: 0,
            rebuildBonuses: 0, lastPlayedCard: null, protocolBypassCount: 0,
            nextProtocolShieldBonus: 0, nextProtocolEffectRepeat: 0, doubleNetworkStacks: false,
            energyCarryOver: false, extractEnergyAmount: 0, networkDmgBonus: 0,
            networkShieldBonus: 0, forceEndTurn: false, skipNextDrawCount: 0,
            turnEndHpPenalty: 0, lastDrawnCard: null, deferredActions: []
        });
        const state = {
            playerA: makePlayer(deckA), playerB: makePlayer(deckB),
            turn: 0, phase: 'start', winner: null, termination: null,
            cardUsageLogA: [], cardUsageLogB: [], turnLog: []
        };
        state.playerA.opponent = state.playerB;
        state.playerB.opponent = state.playerA;
        for (const side of ['A', 'B']) {
            const entity = state['player' + side];
            Object.defineProperty(entity, '_state', { value: state });
            Object.defineProperty(entity, '_side', { value: side });
        }
        return state;
    }

    makeContext(caster, target = caster.opponent, card = null, effect = null) {
        const state = caster._state;
        return {
            caster, target, card, effect, engine: this, overclockScale: 0,
            overclockConsumed: 0, energyConsumed: 0, strengthApplied: false,
            cardDamageMultiplier: 0, depth: 0, abortRemainingEffects: false,
            openAccessFilter: null,
            state: { player: caster, enemy: target, turn: state?.turn ?? 0,
                phase: 'action', cardUsageLog: this._usageLog(caster), turnLog: state?.turnLog ?? [] }
        };
    }

    _usageLog(entity) {
        return entity?._state?.['cardUsageLog' + entity._side] ?? [];
    }

    logEffect(entity, source, text) {
        this._usageLog(entity).push({ type: 'effect', source, effect: text });
    }

    executeEffects(effects, ctx) {
        this.effectRegistry.executeAll(effects, ctx);
    }

    isBattleEnded(entity) {
        return Boolean(entity?._state?.winner);
    }

    getEffectiveCost(card, caster) {
        if (!caster) return card.cost;
        if (card.scaledCost) {
            const allowed = ['overclockStacks', 'strength', 'shield', 'energy'];
            const value = allowed.includes(card.scaledCost.source) ? caster[card.scaledCost.source] : 0;
            return Math.max(card.scaledCost.min ?? 0,
                card.cost - value * (card.scaledCost.reductionPerUnit ?? 0));
        }
        if (card.dynamicCost?.condition && caster.opponent) {
            return evaluateCondition(card.dynamicCost.condition, this.makeContext(caster))
                ? card.dynamicCost.cost : card.cost;
        }
        return card.cost;
    }

    canPlayCard(caster, index) {
        if (!caster || this.isBattleEnded(caster) || caster.forceEndTurn) return false;
        const card = caster.hand[index];
        if (!card || index < 0 || !Number.isInteger(index)) return false;
        if (card.requiresOverclock && caster.overclockStacks <= 0) return false;
        if ((card.overclockThreshold ?? 0) > caster.overclockStacks) return false;
        if ((card.overflowMin ?? 0) > caster.overflowNext) return false;
        if ((card.virusThreshold ?? 0) > (caster.opponent?.virus ?? 0)) return false;
        const cost = this.getEffectiveCost(card, caster);
        if (caster.energy >= cost) return true;
        const bankruptcy = caster.activeCores.find(c => c.coreEffect?.coreType === 'bankruptcy');
        const rate = bankruptcy?.coreEffect.value > 0 ? Math.trunc(bankruptcy.coreEffect.value) : 10;
        return Boolean(bankruptcy && caster.hp > (cost - caster.energy) * rate);
    }

    playCard(state, index) {
        return this._executeCard(state.player, state.enemy, index);
    }

    _mirrorPlayCard(state, side, index) {
        return this._executeCard(state['player' + side],
            state['player' + (side === 'A' ? 'B' : 'A')], index);
    }

    _executeCard(caster, target, index) {
        if (!this.canPlayCard(caster, index)) return false;
        const card = caster.hand[index];
        this._prepareCardChoices(caster, card);
        const lastBefore = caster.lastPlayedCard;
        const cost = this.getEffectiveCost(card, caster);
        if (caster.energy >= cost) caster.energy -= cost;
        else {
            const core = caster.activeCores.find(c => c.coreEffect?.coreType === 'bankruptcy');
            const rate = core?.coreEffect.value > 0 ? Math.trunc(core.coreEffect.value) : 10;
            caster.hp -= (cost - caster.energy) * rate;
            caster.energy = 0;
        }
        this._recordCardPlayed(caster, card);
        for (const other of caster.hand) {
            if (other !== card && other.accumulationTarget > 0)
                other.accumulationCount = (other.accumulationCount ?? 0) + 1;
        }
        const ctx = this.makeContext(caster, target, card);
        ctx.overclockScale = hasKeyword(card, 'overclock') ? 1 + caster.overclockStacks * 0.1 : 0;
        ctx.cardDamageMultiplier = this._thirdCardMultiplier(caster);
        ctx.openAccessFilter = this.pendingOpenAccessFilter;
        this.pendingOpenAccessFilter = null;
        caster.hand.splice(index, 1);
        this._runCardEffects(ctx);
        this.checkCoreTriggers('cardPlayed', caster, card);
        if (caster.lastPlayedCard === lastBefore) caster.lastPlayedCard = card;
        if (card.type === 'power') {
            if (!caster.activeCores.some(c => c.id === card.id)) {
                caster.activeCores.push(card);
                applyImmediateCore(this, card, caster);
            }
        } else if (!caster.hand.includes(card) && !hasKeyword(card, 'ransomware')) {
            if (card.rebuildScaling && !card.rebuildScalingApplied) {
                card.rebuildScalingApplied = true;
                let count = (card.rebuildCount ?? 0) + roundToInt(computeScalingValue(card.rebuildScaling, ctx));
                if (card.rebuildScaling.max > 0) count = Math.min(count, card.rebuildScaling.max);
                if (card.rebuildScaling.min > 0) count = Math.max(count, card.rebuildScaling.min);
                card.rebuildCount = Math.max(0, count);
            }
            this.applyRebuildOrVoid(caster, card);
        }
        this._usageLog(caster).push({
            turn: caster._state?.turn ?? 0, cardId: card.id, cardName: card.name,
            pack: card.pack, rarity: card.rarity, playerHpAfter: caster.hp, enemyHpAfter: target.hp
        });
        this.checkBattleEnd(caster);
        this.pendingDismantleTargets.length = 0;
        return true;
    }

    _prepareCardChoices(caster, card) {
        if (this.pendingDismantleTargets.length) return;
        const chosen = (card.effects ?? []).filter(effect => effect.mode === 'chosen');
        if (!chosen.length) return;
        // BattleInitializer selects after the advance draw, then skips that draw in effects.
        const drawFirst = Math.max(0, ...chosen.map(effect => effect.drawBeforeSelect ?? 0));
        if (drawFirst > 0) {
            this.drawCards(caster, drawFirst);
            caster.skipNextDrawCount += drawFirst;
        }
        const count = chosen.reduce((sum, effect) => sum + Math.max(1, roundToInt(effect.value ?? 1)), 0);
        const filter = chosen.find(effect => effect.filter)?.filter;
        const candidates = caster.hand.filter(other => other !== card && (!filter || matchesFilter(other, filter)));
        const copy = chosen.every(effect => effect.type === 'cloneHandCard');
        // AI choice replaces the player's selection dialog; effect execution remains shared.
        candidates.sort((a, b) => {
            if (!copy) {
                const extract = Number(Boolean(b.extractEffects?.length)) - Number(Boolean(a.extractEffects?.length));
                if (extract) return extract;
            }
            return b.cost - a.cost;
        });
        this.pendingDismantleTargets.push(...candidates.slice(0, copy ? 1 : count));
    }

    _recordCardPlayed(caster, card) {
        caster.turn.cardsPlayedThisTurn++;
        if (card.type === 'skill') caster.turn.skillsPlayedThisTurn++;
        const amount = caster.turn.virusOnCardPlayedThisTurn;
        if (amount > 0) {
            caster.virus += amount;
            this.notifyVirusApplied(caster.opponent ?? caster, caster, amount);
        }
        if (hasKeyword(card, 'network')) {
            caster.turn.networkCardsPlayedThisTurn++;
            caster.networkCardsPlayedThisBattle++;
        }
    }

    _thirdCardMultiplier(caster) {
        return caster.turn.cardsPlayedThisTurn === 3 &&
            caster.activeCores.some(c => c.coreEffect?.coreType === 'doubleThirdNetwork') ? 2 : 0;
    }

    _runCardEffects(ctx, freshAccumulationContext = true) {
        const { caster, card } = ctx;
        let triggered = false;
        if (card.protocolCondition && card.protocolEffects) {
            triggered = this.checkProtocolCondition(card, caster, true);
            if (triggered) {
                this.executeEffects(card.protocolEffects, ctx);
                const repeats = caster.nextProtocolEffectRepeat;
                if (repeats > 0) {
                    caster.nextProtocolEffectRepeat = 0;
                    for (let i = 0; i < repeats; i++) this.executeEffects(card.protocolEffects, ctx);
                }
                if (caster.nextProtocolShieldBonus > 0) {
                    caster.shield += caster.nextProtocolShieldBonus;
                    caster.nextProtocolShieldBonus = 0;
                }
            }
        }
        if (!(triggered && card.protocolOverride)) this.executeEffects(card.effects, ctx);
        if (hasKeyword(card, 'overclock') &&
            (caster.overclockUnlimited || caster.overclockStacks < caster.overclockMax))
            caster.overclockStacks++;
        if (hasKeyword(card, 'network')) caster.networkStacks += caster.doubleNetworkStacks ? 2 : 1;
        if (card.accumulationTarget > 0 && (card.accumulationCount ?? 0) >= card.accumulationTarget &&
            card.accumulationEffects?.length) {
            this.executeEffects(card.accumulationEffects,
                freshAccumulationContext ? this.makeContext(caster, ctx.target, card) : ctx);
            card.accumulationCount = 0;
        }
    }

    executeRemoteCard(card, caster, target, parentCtx = null) {
        this._recordCardPlayed(caster, card);
        for (const other of caster.hand) {
            if (other.accumulationTarget > 0)
                other.accumulationCount = (other.accumulationCount ?? 0) + 1;
        }
        const ctx = this.makeContext(caster, target, card);
        ctx.overclockScale = hasKeyword(card, 'overclock') ? 1 + caster.overclockStacks * 0.1 : 0;
        ctx.cardDamageMultiplier = this._thirdCardMultiplier(caster);
        if (parentCtx?.card) caster.lastPlayedCard = parentCtx.card;
        this._runCardEffects(ctx, false);
        this.checkCoreTriggers('cardPlayed', caster, card);
        caster.lastPlayedCard = card;
        this._usageLog(caster).push({
            turn: caster._state?.turn ?? 0, cardId: card.id, cardName: card.name,
            pack: card.pack, rarity: card.rarity, playerHpAfter: caster.hp, enemyHpAfter: target.hp
        });
        this.checkBattleEnd(caster);
    }

    checkProtocolCondition(card, caster, consume = false) {
        if (!card.protocolCondition) return false;
        if (consume && caster.protocolBypassCount > 0) {
            caster.protocolBypassCount--;
            return true;
        }
        const condition = card.protocolCondition;
        if (condition === 'any') return true;
        if (condition === 'luckMin') return caster.luck >= (card.protocolConditionValue ?? 0);
        const last = caster.lastPlayedCard;
        if (!last) return false;
        switch (condition) {
            case 'sameType': return last.type === card.type;
            case 'differentType': return last.type !== card.type;
            case 'attack': return last.type === 'attack';
            case 'skill': return last.type === 'skill';
            case 'network': return hasKeyword(last, 'network');
            case 'costHigher': return last.cost > card.cost;
            case 'costLower': return last.cost < card.cost;
            case 'zeroCost': return last.cost === 0;
            default: return false;
        }
    }

    applyDamage(target, amount, attacker = null, bypassShield = false, triggerRetaliation = true) {
        if (amount <= 0 || target.turn.invincibleThisTurn) return;
        if (target.turn.evadeNextHits > 0) {
            target.turn.evadeNextHits--;
            return;
        }
        if (target.turn.damageReductionThisTurn > 0) {
            amount = roundToInt(amount * (1 - target.turn.damageReductionThisTurn));
            if (amount <= 0) return;
        }
        const dodge = target.hand.find(c => c.id === 'BASE_014');
        if (dodge) {
            amount = Math.max(1, Math.trunc(amount / 2));
            target.hand.splice(target.hand.indexOf(dodge), 1);
            this.dismantleCard(target, dodge);
        }
        const absorbed = bypassShield ? 0 : Math.min(target.shield, amount);
        target.shield -= absorbed;
        target.hp = Math.max(0, target.hp - amount + absorbed);
        if (attacker) attacker.turn.totalDamageThisTurn += amount;
        if (triggerRetaliation && attacker && attacker !== target && target.hp > 0 &&
            target.turn.retaliateOnHitDamage > 0) {
            const damage = Math.max(1, target.turn.retaliateOnHitDamage + target.strength - target.weakness);
            target.turn.retaliateOnHitDamage = 0;
            this.applyDamage(attacker, damage, target, false, false);
        }
        this.checkBattleEnd(target);
    }

    applySelfDamage(caster, amount) {
        if (amount <= 0) return;
        if (caster.turn.preventNextSelfDamage) {
            caster.turn.preventNextSelfDamage = false;
            return;
        }
        const absorbed = Math.min(caster.shield, amount);
        caster.shield -= absorbed;
        const lost = amount - absorbed;
        caster.hp = Math.max(0, caster.hp - lost);
        caster.turn.selfDamageThisTurn += lost;
    }

    heal(entity, amount) {
        entity.hp = Math.min(entity.maxHp, entity.hp + amount);
    }

    drawCards(entity, count) {
        const names = [];
        while (names.length < count && entity.drawPile.length > 0 && entity.hand.length < 10) {
            const card = entity.drawPile.shift();
            entity.hand.push(card);
            entity.lastDrawnCard = card;
            names.push(card.name);
        }
        if (names.length)
            this._usageLog(entity).push({ type: 'draw', source: '드로우', cards: names });
        return names.length;
    }

    drawCard(entity) { return this.drawCards(entity, 1); }

    dismantleCardAt(entity, index) {
        if (index < 0 || index >= entity.hand.length) return;
        const [card] = entity.hand.splice(index, 1);
        this.dismantleCard(entity, card);
    }

    dismantleCard(entity, card, source = 'hand') {
        if (!card) return;
        const index = entity.hand.indexOf(card);
        if (index >= 0) entity.hand.splice(index, 1);
        this._usageLog(entity).push({ type: 'dismantle', source, cardName: card.name });
        if (card.extractEffects?.length)
            this.executeEffects(card.extractEffects, this.makeContext(entity, entity.opponent, card));
        if (entity.turn.extractEnergyBonusActive && entity.extractEnergyAmount > 0 &&
            entity.turn.extractEnergyRemainingCount > 0) {
            entity.energy += entity.extractEnergyAmount;
            entity.turn.extractEnergyRemainingCount--;
        }
        entity.turn.dismantledThisTurn++;
        entity.dismantledThisBattle++;
        this.applyRebuildOrVoid(entity, card);
        this.checkCoreTriggers('dismantle', entity, card);
    }

    applyRebuildOrVoid(entity, card) {
        if ((card.rebuildCount ?? 0) > 0) {
            card.rebuildCount--;
            entity.hand.push(card);
            entity.totalRebuildsThisBattle++;
            for (const held of entity.hand) {
                if (hasKeyword(held, 'rebuildAccum'))
                    held.accumulationCount = (held.accumulationCount ?? 0) + 1;
            }
            this.checkCoreTriggers('rebuild', entity, card);
        } else entity.voidPile.push(card);
    }

    enqueueDeferred(ctx, timing, effect) {
        ctx.caster.deferredActions.push({
            timing, effect, caster: ctx.caster, target: ctx.target, card: ctx.card
        });
    }

    _processDeferred(entity, timing) {
        const actions = entity.deferredActions.filter(a => a.timing === timing);
        entity.deferredActions = entity.deferredActions.filter(a => a.timing !== timing);
        for (const action of actions) {
            if (this.isBattleEnded(entity)) break;
            const ctx = this.makeContext(action.caster, action.target, action.card, action.effect);
            this.effectRegistry.execute(action.effect.type, ctx);
        }
    }

    startTurn(entity) {
        if (this.isBattleEnded(entity)) return;
        entity.energy = entity.energyCarryOver ? Math.min(entity.energy + entity.baseEnergy, 10) : entity.baseEnergy;
        entity.energy = Math.max(0, entity.energy - entity.overflowNext);
        entity.overflowNext = 0;
        entity.energy = Math.max(0, entity.energy - entity.energyDrainNext);
        entity.energyDrainNext = 0;
        entity.turn = newTurnCounters();
        entity.turn.virusOnCardPlayedThisTurn = entity.virusOnCardPlayedNextTurn;
        entity.virusOnCardPlayedNextTurn = 0;
        entity.forceEndTurn = false;
        const enemy = entity.opponent;
        if (enemy.corrosion > 0) {
            enemy.shield = Math.max(0, enemy.shield - enemy.corrosion);
            enemy.corrosion--;
        }
        const wanted = Math.max(0, entity.baseDraw + entity.extraDraw - entity.hand.length);
        const drawn = this.drawCards(entity, wanted);
        for (const card of entity.hand) {
            if (card.id === 'STATUS_STRUGGLE') {
                this._statusDamage(entity, Math.max(1, roundToInt(entity.maxHp * 0.1)));
                if (this.isBattleEnded(entity)) return;
            }
        }
        if (wanted > 0 && drawn === 0 && entity.hand.length < 10) {
            const struggle = getSpecialCardById('STATUS_STRUGGLE');
            if (!struggle) throw new Error('STATUS_STRUGGLE 데이터 누락');
            entity.hand.push(cloneCard(struggle));
        }
        for (const card of entity.hand) {
            if (hasKeyword(card, 'ransomware')) {
                const damage = card.ransomwareDamage > 0 ? card.ransomwareDamage : 5;
                this._statusDamage(entity, damage);
                card.ransomwareDamage = damage + 5;
                if (this.isBattleEnded(entity)) return;
            }
        }
        this._processDeferred(entity, 'nextTurnStart');
        if (entity.overclockStacks > 1 && !entity.overclockUnlimited) entity.overclockStacks--;
        applyCoreEffects(this, 'turnStart', entity);
        this.checkBattleEnd(entity);
    }

    _statusDamage(entity, amount) {
        const absorbed = Math.min(entity.shield, amount);
        entity.shield -= absorbed;
        entity.hp = Math.max(0, entity.hp - amount + absorbed);
        this.checkBattleEnd(entity);
    }

    endTurn(entity) {
        if (this.isBattleEnded(entity)) return;
        entity.hp = Math.max(0, entity.hp - entity.turnEndHpPenalty);
        entity.turnEndHpPenalty = 0;
        if (entity.turn.luckyDayDebtActive && entity.turn.luckyDaySuccessCount > 0)
            entity.hp = Math.max(0, entity.hp - entity.turn.luckyDaySuccessCount *
                Math.max(1, entity.turn.luckyDayHpLossPerSuccess));
        for (let i = entity.hand.length - 1; i >= 0; i--) {
            if (entity.hand[i].isTemporary) entity.voidPile.push(...entity.hand.splice(i, 1));
        }
        this._processDeferred(entity, 'turnEnd');
        applyCoreEffects(this, 'turnEnd', entity);
        let decay = 1;
        for (const core of entity.activeCores) {
            if (core.coreEffect?.coreType === 'extraDebuffReduction')
                decay += Math.max(1, Math.trunc(core.coreEffect.value ?? 0));
        }
        entity.weakness = Math.max(0, entity.weakness - decay);
        entity.hand.push(...entity.rollbackStoredHand);
        entity.rollbackStoredHand.length = 0;
        this.checkBattleEnd(entity);
    }

    checkCoreTriggers(event, entity, card = null) {
        checkCoreTriggers(this, event, entity, card);
    }

    notifyVirusApplied(caster, target, amount) {
        target.turn.virusAppliedThisTurn += amount;
        notifyVirusApplied(this, caster, target, amount);
    }

    notifyVirusConsumed(caster, amount) {
        caster.turn.virusConsumedThisTurn += amount;
        notifyVirusConsumed(this, caster, amount);
    }

    notifyGambleResult(caster, success, ctx) {
        notifyGambleResult(this, caster, success, ctx);
    }

    checkBattleEnd(entity) {
        const state = entity?._state;
        if (!state || state.winner) return;
        const revive = target => {
            for (let i = target.activeCores.length - 1; i >= 0; i--) {
                if (target.activeCores[i].coreEffect?.trigger === 'onDeath') {
                    target.hp = Math.max(1, roundToInt(target.maxHp * 0.3));
                    target.activeCores.splice(i, 1);
                    return true;
                }
            }
            return false;
        };
        if (state.playerB.hp <= 0 && !revive(state.playerB)) state.winner = 'A';
        else if (state.playerA.hp <= 0 && !revive(state.playerA)) state.winner = 'B';
        if (state.winner) state.termination = 'defeat';
    }

    selectCardIndex(cards) {
        let selected = 0;
        for (let i = 1; i < cards.length; i++) {
            if (cards[i].cost > cards[selected].cost) selected = i;
        }
        return selected;
    }

    _shuffleArray(cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
    }

    _cloneCard(card) { return cloneCard(card); }

    _doMirrorMulligan(state, side, strategy) {
        const entity = state['player' + side];
        const indices = strategy({ player: entity, enemy: entity.opponent, turn: 0, phase: 'mulligan' },
            this, 'mulligan');
        if (!Array.isArray(indices)) return;
        const sorted = [...new Set(indices)].filter(i => Number.isInteger(i) && i >= 0 &&
            i < entity.hand.length).sort((a, b) => b - a);
        const removed = sorted.map(i => entity.hand.splice(i, 1)[0]);
        const drawn = [];
        while (drawn.length < removed.length && entity.drawPile.length) {
            const card = entity.drawPile.pop();
            entity.hand.push(card);
            drawn.push(card.name);
        }
        entity.drawPile.push(...removed);
        this._shuffleArray(entity.drawPile);
        if (removed.length)
            this._usageLog(entity).push({ type: 'mulligan', discarded: removed.map(c => c.name), drawn });
    }

    _mirrorPlayerTurn(state, side, strategy, turnEntry) {
        const entity = state['player' + side];
        this._usageLog(entity).push({ type: 'phase', name: '턴 ' + state.turn + ' 시작' });
        this.startTurn(entity);
        for (let i = 0; i < 30 && !state.winner && !entity.forceEndTurn; i++) {
            const decision = strategy({ player: entity, enemy: entity.opponent,
                turn: state.turn, phase: 'action' }, this);
            if (!decision || decision.action !== 'play_card') break;
            const card = entity.hand[decision.cardIndex];
            const before = { ownHp: entity.hp, shield: entity.shield,
                hp: entity.opponent.hp, enemyShield: entity.opponent.shield };
            const cost = card ? this.getEffectiveCost(card, entity) : 0;
            if (!this._mirrorPlayCard(state, side, decision.cardIndex)) break;
            turnEntry.actions.push({
                side, cardName: card.name, cardId: card.id, cardCost: cost, cardType: card.type,
                damageDone: Math.max(0, before.hp - entity.opponent.hp) +
                    Math.max(0, before.enemyShield - entity.opponent.shield),
                selfHpChange: entity.hp - before.ownHp, shieldGained: Math.max(0, entity.shield - before.shield),
                oppHpAfter: entity.opponent.hp, playerHpAfter: entity.hp
            });
        }
        this.endTurn(entity);
    }

    runMirrorBattle(state, aiStrategyA, aiStrategyB, maxTurns = 200, firstSide = null) {
        if (firstSide !== null && firstSide !== 'A' && firstSide !== 'B')
            throw new Error('firstSide must be A, B, or null.');
        this.drawCards(state.playerA, 5);
        this.drawCards(state.playerB, 5);
        this._doMirrorMulligan(state, 'A', aiStrategyA);
        this._doMirrorMulligan(state, 'B', aiStrategyB);
        const first = firstSide ?? (Math.random() < 0.5 ? 'A' : 'B');
        const order = first === 'A' ? ['A', 'B'] : ['B', 'A'];
        while (!state.winner && state.turn < maxTurns) {
            state.turn++;
            const entry = { turn: state.turn, actions: [], hpAfter: {} };
            for (const side of order) {
                if (state.winner) break;
                this._mirrorPlayerTurn(state, side, side === 'A' ? aiStrategyA : aiStrategyB, entry);
            }
            entry.hpAfter = {
                A: { hp: state.playerA.hp, shield: state.playerA.shield },
                B: { hp: state.playerB.hp, shield: state.playerB.shield }
            };
            state.turnLog.push(entry);
        }
        if (!state.winner) {
            state.winner = 'draw';
            state.termination = 'turn_limit';
        }
        return {
            winner: state.winner, termination: state.termination, turns: state.turn,
            playerAHp: state.playerA.hp, playerBHp: state.playerB.hp,
            cardUsageLogA: state.cardUsageLogA, cardUsageLogB: state.cardUsageLogB, turnLog: state.turnLog
        };
    }
}
