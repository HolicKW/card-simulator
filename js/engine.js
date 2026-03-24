/**
 * engine.js — 전투 시뮬레이션 엔진
 * 
 * 게임 규칙을 충실히 구현한 턴제 전투 엔진.
 * - 덱, 핸드, 보이드(소멸) 영역
 * - 멀리건 → 드로우 → 행동 → 적 턴 사이클
 * - 소멸 무덤, 방어도 영구 유지, 힘/약화 등
 */

import { EffectRegistry, registerCoreEffects } from './effects.js';

export class BattleEngine {
    constructor() {
        this.effectRegistry = new EffectRegistry();
        registerCoreEffects(this.effectRegistry);
        this.battleLog = [];
    }

    // ─── 카드 플레이 ───

    playCard(state, cardIndex) {
        const p = state.player;
        const card = p.hand[cardIndex];
        if (!card) return;

        // playCondition 체크 (조건 미충족 시 발동 불가)
        if (card.playCondition) {
            const cond = card.playCondition;
            if (cond.type === 'overclockMin' && (p.overclockStacks || 0) < cond.value) return;
            // 카드 자신을 제외한 남은 패 장수 >= required (overclockScale 지원)
            if (cond.type === 'handSizeMin') {
                const required = (cond.overclockScale && (p.overclockStacks || 0) > 0)
                    ? cond.value * p.overclockStacks
                    : cond.value;
                if ((p.hand.length - 1) < required) return;
            }
        }

        // 다음 카드 자해 면제 플래그 소비
        if (p.preventNextCardSelfDamage) {
            p.preventNextCardSelfDamage = false;
            p._preventSelfDamageThisCard = true;
        } else {
            p._preventSelfDamageThisCard = false;
        }

        // 코스트 차감 (costScaling 적용)
        const effectiveCost = card.costScaling
            ? card.cost + (p[card.costScaling.source] || 0) * card.costScaling.multiplier
            : card.cost;
        p.energy -= effectiveCost;
        p.cardsPlayedThisTurn++;


        // 축적(Accumulation) 카드 처리 로직
        // 패에 있는 나머지 축적 카드들의 카운트를 올려줍니다.
        for (let i = 0; i < p.hand.length; i++) {
            let hCard = p.hand[i];
            if (hCard.keywords && hCard.keywords.includes('accumulation') && hCard.accumulationTarget) {
                hCard.accumulationStack = (hCard.accumulationStack || 0) + card.cost;
            }
        }

        // 핸드에서 제거
        p.hand.splice(cardIndex, 1);

        // 이펙트 실행
        const ctx = {
            state,
            caster: p,
            target: state.enemy,
            card,
            engine: this,
            overclockScale: card.keywords?.includes('overclock') ? p.overclockStacks : 0,
            _dmgFlags: { strengthApplied: false }, // 힘/약화 카드당 1회 적용 추적
            // 영구 기관 코어: 오버클럭 카드 디메리트 스택 고정
            ...(card.keywords?.includes('overclock') && this.hasPower(p, 'fixedDemerit')
                ? { demeritOCScale: p.activePowers.find(pw => pw.powerEffect?.type === 'fixedDemerit').powerEffect.value ?? 3 }
                : {})
        };

        for (const effect of (card.effects || [])) {
            ctx.effect = effect;
            this.effectRegistry.execute(effect.type, ctx);
        }

        // 내 카드가 축적 조건을 완수했으면 축적 이펙트 발동
        if (card.keywords && card.keywords.includes('accumulation') && card.accumulationTarget && card.accumulationEffects) {
            if ((card.accumulationStack || 0) >= card.accumulationTarget) {
                if (state.cardUsageLog) state.cardUsageLog.push({ type: 'effect', source: card.name, effect: 'Accumulation Triggered' });
                for (const aEffect of card.accumulationEffects) {
                    ctx.effect = aEffect;
                    this.effectRegistry.execute(aEffect.type, ctx);
                }
            }
        }

        // 오버클럭 카드이면 스택 증가 (이펙트 처리 후)
        if (card.keywords && card.keywords.includes('overclock')) {
            p.overclockStacks = Math.min(
                (p.overclockStacks || 0) + 1,
                p.overclockMax
            );
        }

        // 네트워크 카드이면 스택 증가 (이펙트 처리 후)
        if (card.keywords && card.keywords.includes('network')) {
            const stackGain = p.doubleNetworkStacks ? 2 : 1;
            p.networkStacks = (p.networkStacks || 0) + stackGain;
            p.networkCardsPlayedThisTurn = (p.networkCardsPlayedThisTurn || 0) + 1;
            p.networkCardsPlayedThisBattle = (p.networkCardsPlayedThisBattle || 0) + 1;
        }

        // 파워 트리거 (카드 연동 효과)
        this._checkPowerTriggers(state, p, state.enemy, 'cardPlayed', card, state.cardUsageLog);

        // 프로토콜 조건 판정 및 효과 발동
        if (card.protocolCondition && (card.protocolEffects || card.protocolElseEffects)) {
            const protocolMet = this._checkProtocolCondition(
                p.lastPlayedCard, card.protocolCondition, p
            );
            if (protocolMet) {
                for (const pEffect of (card.protocolEffects || [])) {
                    ctx.effect = pEffect;
                    this.effectRegistry.execute(pEffect.type, ctx);
                }
            } else {
                for (const pEffect of (card.protocolElseEffects || [])) {
                    ctx.effect = pEffect;
                    this.effectRegistry.execute(pEffect.type, ctx);
                }
            }
        }

        // 마지막 카드 기록 (프로토콜 조건 판정용)
        p.lastPlayedCard = card;

        // 파워 카드 처리
        if (card.type === 'power') {
            p.activePowers.push(this._cloneCard(card));
            // 파워 즉시 효과 적용
            if (card.powerEffect) {
                this._applyImmediatePowerEffect(state, card.powerEffect);
            }
        }

        // 사용 기록
        state.cardUsageLog.push({
            turn: state.turn,
            cardId: card.id,
            cardName: card.name,
            pack: card.pack,
            rarity: card.rarity,
            playerHpAfter: p.hp,
            enemyHpAfter: state.enemy.hp
        });

        // 재구축 처리
        if (card.keywords && card.keywords.includes('rebuild') && card.rebuildCount > 0) {
            const rebuiltCard = this._cloneCard(card);
            rebuiltCard.rebuildCount--;
            // 재구축 보너스
            rebuiltCard.rebuildCount += p.rebuildBonuses || 0;
            if (rebuiltCard.rebuildCount > 0) {
                p.hand.push(rebuiltCard);
                p.totalRebuildsThisBattle++;
                this._triggerRebuildPower(p, rebuiltCard, state.cardUsageLog);
                this._growRebuildCards(p, state.cardUsageLog);
            } else {
                p.void.push(card);
            }
        } else if (card.type !== 'power') {
            // 일반 카드는 보이드로
            p.void.push(card);
        }

        // 자해 면제 임시 플래그 정리
        p._preventSelfDamageThisCard = false;

        // 승패 체크
        if (state.enemy.hp <= 0) {
            state.winner = 'player';
        }
        if (p.hp <= 0) {
            const revive = p.activePowers.find(pw => pw.powerEffect?.type === 'reviveOnce' && !pw._revived);
            if (revive) {
                revive._revived = true;
                p.hp = Math.floor(p.maxHp * (revive.powerEffect.value / 100));
            } else {
                state.winner = 'enemy';
            }
        }
    }

    // ─── 유틸리티 메서드 ───

    applyDamage(target, amount, source, bypassShield = false) {
        if (amount <= 0) return;

        // 긴급 회피 패시브: 손패에 있으면 자동 해체 → 피해 반감 (자해 제외)
        if (!bypassShield && target.hand) {
            const halveIdx = target.hand.findIndex(c => c.passiveEffect?.type === 'discardSelfToHalveDamage');
            if (halveIdx >= 0) {
                const sacrificed = target.hand.splice(halveIdx, 1)[0];
                target.void = target.void || [];
                target.void.push(sacrificed);
                amount = Math.ceil(amount / 2);
            }
        }

        // 누적 데미지 추적 (시전자가 있으면)
        if (source) {
            source.totalDamageThisTurn = (source.totalDamageThisTurn || 0) + amount;
        }

        if (bypassShield) {
            target.hp -= amount;
        } else {
            if (target.shield > 0) {
                if (target.shield >= amount) {
                    target.shield -= amount;
                    return;
                } else {
                    amount -= target.shield;
                    target.shield = 0;
                }
            }
            target.hp -= amount;
        }

        if (target.hp < 0) target.hp = 0;
    }

    drawCard(entity) {
        this._drawCards(entity, 1);
    }

    dismantleCardAt(entity, idx, source = 'Unknown', usageLog = null) {
        if (entity.hand.length === 0 || idx < 0 || idx >= entity.hand.length) return;
        const card = entity.hand.splice(idx, 1)[0];
        if (!card) return;
        entity.lastDismantledCardType = card.type;
        if (usageLog) usageLog.push({ type: 'dismantle', source, cardName: card.name });
        if (this.hasPower(entity, 'drawOnDismantle')) {
            entity._dismantleCounter = (entity._dismantleCounter || 0) + 1;
            const threshold = entity.activePowers.find(p => p.powerEffect?.type === 'drawOnDismantle').powerEffect.threshold || 5;
            if (entity._dismantleCounter % threshold === 0) this._drawCards(entity, 1, 'Power: 고효율 파쇄기', usageLog);
        }
        if (this.hasPower(entity, 'energyAndDrawOnFirstDismantle') && !entity._hasDismantledThisTurn) {
            entity._hasDismantledThisTurn = true;
            entity.energy += 2;
            this._drawCards(entity, 2, 'Power: 블랙홀 분쇄기', usageLog);
        }
        if (card.keywords?.includes('extract') && card.extractEffects) {
            const ctx = { state: { cardUsageLog: usageLog }, caster: entity, target: entity._opponent || entity, card, engine: this };
            for (const effect of card.extractEffects) { ctx.effect = effect; this.effectRegistry.execute(effect.type, ctx); }
        }
        // 무한 동력 수배: 추출 발동마다 에너지 +1 (최대 N회)
        if (card.keywords?.includes('extract') && (entity.extractEnergyBonusLeft || 0) > 0) {
            entity.energy = (entity.energy || 0) + 1;
            entity.extractEnergyBonusLeft--;
            if (usageLog) usageLog.push({ type: 'effect', source: '무한 동력 수배', effect: 'Extract Energy +1' });
        }
        entity.dismantledThisTurn = (entity.dismantledThisTurn || 0) + 1;
        entity.dismantledThisBattle = (entity.dismantledThisBattle || 0) + 1;
        // 재구축 카드 해체: 스택 소모 후 패로 복귀
        if (card.keywords?.includes('rebuild') && card.rebuildCount > 0) {
            const rebuilt = this._cloneCard(card);
            rebuilt.rebuildCount = (rebuilt.rebuildCount - 1) + (entity.rebuildBonuses || 0);
            if (rebuilt.rebuildCount > 0) {
                entity.hand.push(rebuilt);
                entity.totalRebuildsThisBattle++;
                this._triggerRebuildPower(entity, rebuilt, usageLog);
                this._growRebuildCards(entity, usageLog);
                if (usageLog) usageLog.push({ type: 'rebuild', source: card.name, effect: `재구축 해체 복귀 (남은 스택: ${rebuilt.rebuildCount})` });
            } else {
                entity.void = entity.void || [];
                entity.void.push(rebuilt);
            }
            return;
        }
        entity.void = entity.void || [];
        entity.void.push(card);
    }

    dismantleCard(entity, random = true, source = 'Unknown', usageLog = null) {
        if (entity.hand.length === 0) return;

        let idx;
        if (random) {
            idx = Math.floor(Math.random() * entity.hand.length);
        } else {
            // AI에서는 가장 낮은 밸류 카드를 해체
            idx = this._findLowestValueCard(entity.hand);
        }

        const card = entity.hand.splice(idx, 1)[0];
        if (!card) return;
        entity.lastDismantledCardType = card.type;

        // 로그 기록
        if (usageLog) {
            usageLog.push({
                type: 'dismantle',
                source: source,
                cardName: card.name
            });
        }

        // 파워 효과: 영구기관 조립기 (drawOnDismantle/energyAndDrawOnFirstDismantle)
        if (this.hasPower(entity, 'drawOnDismantle')) {
            entity._dismantleCounter = (entity._dismantleCounter || 0) + 1;
            const threshold = entity.activePowers.find(p => p.powerEffect?.type === 'drawOnDismantle').powerEffect.threshold || 5;
            if (entity._dismantleCounter % threshold === 0) {
                this._drawCards(entity, 1, 'Power: 고효율 파쇄기', usageLog);
            }
        }
        if (this.hasPower(entity, 'energyAndDrawOnFirstDismantle') && !entity._hasDismantledThisTurn) {
            entity._hasDismantledThisTurn = true;
            entity.energy += 2;
            this._drawCards(entity, 2, 'Power: 블랙홀 분쇄기', usageLog);
            if (usageLog) usageLog.push({ type: 'power', source: '블랙홀 분쇄기', effect: 'Energy +2, Draw +2' });
        }

        // 추출 트리거
        if (card.keywords && card.keywords.includes('extract') && card.extractEffects) {
            if (usageLog) usageLog.push({ type: 'extract_trigger', source: card.name });
            const ctx = {
                state: { player: entity._opponent ? entity : null, enemy: entity._opponent ? entity._opponent : null, cardUsageLog: usageLog }, // 간이 컨텍스트
                caster: entity,
                target: entity._opponent || entity,
                card,
                engine: this,
                usageLog // effects.js에서 사용 가능하게 주입
            };
            for (const effect of card.extractEffects) {
                ctx.effect = effect;
                this.effectRegistry.execute(effect.type, ctx);
            }
        }
        // 무한 동력 수배: 추출 발동마다 에너지 +1 (최대 N회)
        if (card.keywords?.includes('extract') && (entity.extractEnergyBonusLeft || 0) > 0) {
            entity.energy = (entity.energy || 0) + 1;
            entity.extractEnergyBonusLeft--;
            if (usageLog) usageLog.push({ type: 'effect', source: '무한 동력 수배', effect: 'Extract Energy +1' });
        }

        entity.dismantledThisTurn = (entity.dismantledThisTurn || 0) + 1;
        entity.dismantledThisBattle = (entity.dismantledThisBattle || 0) + 1;
        // 재구축 카드 해체: 스택 소모 후 패로 복귀
        if (card.keywords && card.keywords.includes('rebuild') && card.rebuildCount > 0) {
            const rebuilt = this._cloneCard(card);
            rebuilt.rebuildCount = (rebuilt.rebuildCount - 1) + (entity.rebuildBonuses || 0);
            if (rebuilt.rebuildCount > 0) {
                entity.hand.push(rebuilt);
                entity.totalRebuildsThisBattle++;
                this._triggerRebuildPower(entity, rebuilt, usageLog);
                if (usageLog) usageLog.push({ type: 'rebuild', source: card.name, effect: `재구축 해체 복귀 (남은 스택: ${rebuilt.rebuildCount})` });
            } else {
                entity.void = entity.void || [];
                entity.void.push(rebuilt);
            }
            return;
        }
        entity.void = entity.void || [];
        entity.void.push(card);
    }

    _drawCards(entity, count, source = 'Turn Start', usageLog = null) {
        const maxHand = 10;
        let drawnCards = [];
        for (let i = 0; i < count; i++) {
            if (entity.hand.length >= maxHand) break;
            if (entity.drawPile.length === 0) break;

            let card = entity.drawPile.shift();
            // 축적 카드 초기화 (패에 들어올 때 스택 0)
            if (card.keywords && card.keywords.includes('accumulation')) {
                card.accumulationStack = 0;
            }
            entity.hand.push(card);
            drawnCards.push(card.name);
        }

        if (drawnCards.length > 0 && usageLog) {
            usageLog.push({
                type: 'draw',
                source: source,
                cards: drawnCards
            });
        }
        return drawnCards;
    }

    hasPower(entity, powerType) {
        return entity.activePowers && entity.activePowers.some(pw => pw.powerEffect?.type === powerType);
    }

    heal(entity, amount) {
        entity.hp = Math.min((entity.hp || 0) + amount, entity.maxHp || 80);
    }

    // 재구축 복귀 시 파워 효과 발동 (영구기관 조립기 등)
    // 재구축 발동 시 패에 있는 rebuildGrowth 카드의 피해 성장 (리사이클 빔 등)
    _growRebuildCards(entity, usageLog) {
        for (const card of (entity.hand || [])) {
            if (!card.rebuildGrowth) continue;
            for (const effect of (card.effects || [])) {
                if (effect.type === 'damage') {
                    effect.value += card.rebuildGrowth;
                    if (usageLog) usageLog.push({ type: 'effect', source: card.name, effect: `재구축 성장: 피해 +${card.rebuildGrowth} (현재 ${effect.value})` });
                }
            }
        }
    }

    _triggerRebuildPower(entity, rebuiltCard, usageLog) {
        for (const power of (entity.activePowers || [])) {
            const pe = power.powerEffect;
            if (!pe || pe.type !== 'healAndCostReductionOnRebuild') continue;
            this.heal(entity, pe.heal);
            rebuiltCard.cost = Math.max(0, (rebuiltCard.cost || 0) - pe.costReduction);
            if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `재구축 복귀: 회복 ${pe.heal}, 코스트 -${pe.costReduction}` });
        }
    }

    /**
     * 오버드라이브 코어 코스트 감소 헬퍼
     * 패에 있는 costReductionPerOverclock 이펙트를 가진 카드의 코스트를
     * 오버클럭 스택 감소량만큼 1씩 줄임 (최소 0)
     */
    _reduceOverdriveCost(entity, amount) {
        if (!entity.hand || amount <= 0) return;
        for (const card of entity.hand) {
            const hasEffect = (card.effects || []).some(e => e.type === 'costReductionPerOverclock');
            if (hasEffect) {
                card.cost = Math.max(0, card.cost - amount);
            }
        }
    }

    _triggerVirusConsumePowers(caster, amountConsumed) {
        // 생물학적 무기 금고: 소모량/2 버림 만큼 힘
        if (this.hasPower(caster, 'bio_weapon_vault')) {
            caster.strength = (caster.strength || 0) + Math.floor(amountConsumed / 2);
        }
        // 면역계 장악: 소모량/2 버림 방어
        if (this.hasPower(caster, 'immune_system_takeover')) {
            caster.shield = (caster.shield || 0) + Math.floor(amountConsumed / 2);
        }
        // 절대 감염체 코스트: 1 에너지
        if (this.hasPower(caster, 'absolute_carrier')) {
            caster.energy = Math.min((caster.energy || 0) + 1, caster.maxEnergyPool || 10);
        }
    }

    _applyPowerEffects(state, p, opponent, timing, usageLog) {
        let maxEnergyPool = 10;
        let removeOverclockLimit = false;

        // 턴 시작 시 파워 트리거 카운터 리셋 (shieldOnOverclock 등)
        if (timing === 'turnStart') {
            for (const power of p.activePowers) {
                if (power.powerEffect) {
                    power.powerEffect._triggeredThisTurn = 0;
                }
            }
        }

        for (const power of p.activePowers) {
            if (!power.powerEffect) continue;
            const pe = power.powerEffect;
            if (pe.type === 'energyCarryOver') maxEnergyPool = pe.maxEnergy || 10;
            if (pe.type === 'removeOverclockLimit') removeOverclockLimit = true;

            if (timing === 'turnStart') {
                switch (pe.type) {
                    case 'extraDraw':
                        break;
                    case 'extraEnergy':
                        p.energy += pe.value;
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Energy +${pe.value}` });
                        break;
                    case 'overclockPerTurn':
                        p.energy = Math.max(0, p.energy - (pe.energyCost || 0));
                        p.overclockStacks = Math.min(
                            p.overclockStacks + pe.value,
                            removeOverclockLimit ? 999 : p.overclockMax
                        );
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Overclock +${pe.value}` });
                        break;
                    // 바이오닉 파워
                    case 'autoVirus':
                        opponent.virus = (opponent.virus || 0) + pe.value;
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Virus to Enemy +${pe.value}` });
                        break;
                    case 'autoCorrosion':
                        opponent.corrosion = (opponent.corrosion || 0) + pe.value;
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Corrosion to Enemy +${pe.value}` });
                        break;
                    case 'absolute_carrier':
                        opponent.virus = (opponent.virus || 0) + 5;
                        opponent.corrosion = (opponent.corrosion || 0) + (pe.value || 1);
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Virus +5, Corrosion +${pe.value || 1} to Enemy` });
                        break;
                    case 'virus_farm_start': {
                        const virusNow = opponent.virus || 0;
                        if (virusNow > 0) {
                            const farmStartDmg = pe.roundedDown
                                ? Math.floor(virusNow * 0.25)
                                : Math.ceil(virusNow * 0.25);
                            if (farmStartDmg > 0) {
                                this.applyDamage(opponent, farmStartDmg, p);
                                if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Virus Farm(Start) Damage ${farmStartDmg}` });
                            }
                        }
                        break;
                    }
                    case 'randomBuffStart':
                        this.effectRegistry.execute('randomBuff', { effect: {}, caster: p, target: opponent, engine: this, state });
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: 'Random Buff triggered' });
                        break;
                }
            }

            if (timing === 'turnEnd') {
                switch (pe.type) {
                    case 'healOnHighOverclock':
                        if (p.overclockStacks >= pe.threshold) {
                            p.overclockStacks--;
                            this._reduceOverdriveCost(p, 1);
                            p.hp = Math.min(p.hp + pe.value, p.maxHp);
                            if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Heal ${pe.value}, Overclock -1` });
                        }
                        break;
                }
            }
        }
    }

    _applyImmediatePowerEffect(state, pe) {
        const p = state.player;
        switch (pe.type) {
            case 'extraDraw':
                p.extraDraw += pe.value;
                break;
            case 'extraEnergy':
                p.baseEnergy += pe.value;
                break;
            case 'rebuildBonus':
                p.rebuildBonuses += pe.value;
                break;
            case 'permanentNetworkBuff':
                p.networkDamageBuff = (p.networkDamageBuff || 0) + pe.damage;
                p.networkShieldBuff = (p.networkShieldBuff || 0) + pe.shield;
                break;
            case 'doubleNetworkStacks':
                p.doubleNetworkStacks = true;
                break;
            case 'energyCarryOver':
                p.energyCarryOver = true;
                p.maxEnergyPool = pe.maxEnergy || 10;
                break;
        }
    }

    _checkPowerTriggers(state, p, opponent, event, card, usageLog) {
        for (const power of p.activePowers) {
            if (!power.powerEffect) continue;
            const pe = power.powerEffect;

            if (event === 'turnEnd') {
                if (pe.type === 'strengthOnManyCards' && p.cardsPlayedThisTurn >= pe.threshold) {
                    p.strength += pe.value;
                    if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Strength +${pe.value}` });
                }
            }

            if (event === 'cardPlayed' && card) {
                if (pe.type === 'shieldOnOverclock' && card.keywords?.includes('overclock')) {
                    pe._triggeredThisTurn = (pe._triggeredThisTurn || 0) + 1;
                    if (pe._triggeredThisTurn <= (pe.maxPerTurn || 5)) {
                        p.shield += pe.value;
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Shield +${pe.value}` });
                    }
                }
                if (pe.type === 'damageOnSelfDamage' && p.selfDamageThisTurn > 0) {
                    this.applyDamage(opponent, p.selfDamageThisTurn, p);
                    if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Reflected ${p.selfDamageThisTurn} Dmg` });
                }
                // 광기의 톱니바퀴: 카드 사용 시 양쪽 모두 오버클럭 스택만큼 피해
                if (pe.type === 'madGearBothDamage') {
                    const stacks = p.overclockStacks || 0;
                    if (stacks > 0) {
                        this.applyDamage(p, stacks);
                        this.applyDamage(opponent, stacks, p);
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Mad Gear: Both take ${stacks} Dmg` });
                    }
                }
                if (pe.type === 'damageOnDismantle' && p.dismantledThisTurn > 0) {
                    this.applyDamage(opponent, pe.value, p);
                    if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Dealt ${pe.value} Dmg` });
                }
                // 네트워크: 프로토콜 달성 시 데미지+방어도
                if (pe.type === 'damageAndShieldOnProtocol' && card.protocolCondition) {
                    const protocolMet = this._checkProtocolCondition(p._prevCardForProtocol, card.protocolCondition, p); // 직전 카드 기준 재판정
                    if (protocolMet) {
                        this.applyDamage(opponent, pe.damage, p);
                        p.shield += pe.shield;
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Protocol Met: Dmg ${pe.damage}, Shield ${pe.shield}` });
                    }
                }
                // 네트워크: 3장 사용 시 드로우
                if (pe.type === 'drawOnNetworkThreshold' && card.keywords?.includes('network')) {
                    if ((p.networkCardsPlayedThisTurn || 0) === pe.threshold) {
                        this._drawCards(p, pe.value, `Power: ${power.name}`, usageLog);
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Draw +${pe.value}` });
                    }
                }
                // 네트워크: 3번째 네트워크 카드 2배
                if (pe.type === 'doubleThirdNetwork' && card.keywords?.includes('network')) {
                    if ((p.networkCardsPlayedThisTurn || 0) === 3) {
                        // 간단한 근사: 추가 데미지 및 방어도
                        for (const ef of (card.effects || [])) {
                            if (ef.type === 'damage' || ef.type === 'scaledDamage') {
                                this.applyDamage(opponent, ef.value || 0, p);
                            }
                            if (ef.type === 'shield' || ef.type === 'scaledShield') {
                                p.shield += (ef.value || 0);
                            }
                        }
                        if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Duplicated Effects` });
                    }
                }
                // 네트워크: 카드 N번째 사용 시 에너지
                if (pe.type === 'energyOnCardCount' && pe.thresholds?.includes(p.cardsPlayedThisTurn)) {
                    p.energy += pe.value;
                    if (usageLog) usageLog.push({ type: 'power', source: power.name, effect: `Energy +${pe.value}` });
                }
            }
        }
    }

    // ─── 프로토콜 조건 판정 ───

    _checkProtocolCondition(lastCard, condition, caster) {
        // 프로토콜 우회 카운트가 있으면 자동 충족
        if (caster.protocolBypassCount > 0) {
            caster.protocolBypassCount--;
            return true;
        }
        // 직전 카드가 없으면 실패
        if (!lastCard) return false;

        switch (condition) {
            case 'network':
                return lastCard.keywords?.includes('network') || false;
            case 'attack':
                return lastCard.type === 'attack';
            case 'skill':
                return lastCard.type === 'skill';
            case 'power':
                return lastCard.type === 'power';
            case 'zeroCost':
                return lastCard.cost === 0;
            case 'dismantle':
                return lastCard.keywords?.includes('dismantle') || false;
            case 'selfDamage':
                return lastCard.keywords?.includes('overclock') || false;
            case 'any':
                return true;
            default:
                return false;
        }
    }

    _findLowestValueCard(hand) {
        let minIdx = 0;
        let minVal = Infinity;
        hand.forEach((card, i) => {
            // 간단한 밸류 추정: 코스트가 낮을수록, 기본 공격/스킬일수록 해체 대상
            const val = card.cost + (card.rarity === 'common' ? 0 : card.rarity === 'rare' ? 1 : 2);
            if (val < minVal) {
                minVal = val;
                minIdx = i;
            }
        });
        return minIdx;
    }

    // 에너지 획득 해체용: 코스트 높고 가치 낮은 카드 선택
    // score = cost×2 - rarityBonus (높을수록 해체 우선)
    _findHighCostLowValueCard(hand) {
        const rarityBonus = { common: 0, rare: 1, epic: 2, legendary: 3, unique: 3 };
        let maxIdx = 0;
        let maxScore = -Infinity;
        hand.forEach((card, i) => {
            const score = (card.cost || 0) * 2 - (rarityBonus[card.rarity] ?? 1);
            if (score > maxScore) {
                maxScore = score;
                maxIdx = i;
            }
        });
        return maxIdx;
    }

    _cloneCard(card) {
        return JSON.parse(JSON.stringify(card));
    }

    _shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ═══════════════════════════════════════════
    //  AI vs AI 대칭 전투 (미러매치)
    // ═══════════════════════════════════════════

    /**
     * 대칭 전투 상태 생성
     * @param {Object[]} deckA - 좌 AI 덱
     * @param {Object[]} deckB - 우 AI 덱
     * @param {Object} config - { hp, maxHp }
     */
    createMirrorBattleState(deckA, deckB, config = {}) {
        const hp = config.hp || 80;
        const makePlayer = (deck) => ({
            hp, maxHp: hp,
            shield: 0,
            energy: config.energy || 3,
            baseEnergy: config.energy || 3,
            strength: 0, weakness: 0,
            overclockStacks: 0, overclockMax: 4,
            overloadNext: 0, energyDrainNext: 0, selfDamageThisTurn: 0,
            dismantledThisTurn: 0, dismantledThisBattle: 0,
            cardsPlayedThisTurn: 0,
            drawPile: this._shuffleArray(deck.map(c => this._cloneCard(c))),
            hand: [], void: [], activePowers: [],
            baseDraw: 5, extraDraw: 0,
            rebuildBonuses: 0, totalRebuildsThisBattle: 0,
            networkStacks: 0, networkCardsPlayedThisTurn: 0,
            networkCardsPlayedThisBattle: 0, totalDamageThisTurn: 0,
            lastPlayedCard: null, protocolBypassCount: 0
        });

        const playerA = makePlayer(deckA);
        const playerB = makePlayer(deckB);
        playerA._opponent = playerB;
        playerB._opponent = playerA;

        return {
            playerA, playerB,
            turn: 0, phase: 'start', winner: null,
            cardUsageLogA: [], cardUsageLogB: [],
            turnLog: [] // 턴별 상세 기록
        };
    }

    /**
     * 대칭 전투 실행 (AI vs AI)
     * 턴별 상세 로그 포함
     */
    runMirrorBattle(state, aiStrategyA, aiStrategyB, maxTurns = 50) {
        // 초기 드로우
        this._drawCards(state.playerA, 5);
        this._drawCards(state.playerB, 5);

        // 멀리건
        this._doMirrorMulligan(state, 'A', aiStrategyA);
        this._doMirrorMulligan(state, 'B', aiStrategyB);

        // 선공 랜덤
        const firstSide = Math.random() < 0.5 ? 'A' : 'B';

        // 교착 상태 감지 카운터
        let consecutiveIdleTurns = 0;

        while (!state.winner && state.turn < maxTurns) {
            state.turn++;
            const turnEntry = {
                turn: state.turn,
                actions: [],
                hpAfter: {}
            };

            if (firstSide === 'A') {
                this._mirrorPlayerTurn(state, 'A', aiStrategyA, turnEntry);
                if (!state.winner) this._mirrorPlayerTurn(state, 'B', aiStrategyB, turnEntry);
            } else {
                this._mirrorPlayerTurn(state, 'B', aiStrategyB, turnEntry);
                if (!state.winner) this._mirrorPlayerTurn(state, 'A', aiStrategyA, turnEntry);
            }

            turnEntry.hpAfter = {
                A: { hp: state.playerA.hp, shield: state.playerA.shield },
                B: { hp: state.playerB.hp, shield: state.playerB.shield }
            };
            state.turnLog.push(turnEntry);

            if (state.winner) break;

            // 교착 상태 감지: 양쪽 모두 카드를 내지 않은 턴이면 카운트 증가
            if (turnEntry.actions.length === 0) {
                consecutiveIdleTurns++;
            } else {
                consecutiveIdleTurns = 0;
            }

            // 3턴 연속 양쪽 무행동 → HP 판정 종료
            if (consecutiveIdleTurns >= 3) {
                state.winner = state.playerA.hp >= state.playerB.hp ? 'A' : 'B';
                break;
            }
        }

        if (!state.winner) {
            const rA = state.playerA.hp / state.playerA.maxHp;
            const rB = state.playerB.hp / state.playerB.maxHp;
            state.winner = rA >= rB ? 'A' : 'B';
        }

        return {
            winner: state.winner,
            turns: state.turn,
            playerAHp: state.playerA.hp,
            playerBHp: state.playerB.hp,
            cardUsageLogA: state.cardUsageLogA,
            cardUsageLogB: state.cardUsageLogB,
            turnLog: state.turnLog
        };
    }

    _doMirrorMulligan(state, side, aiStrategy) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;
        const usageLog = side === 'A' ? state.cardUsageLogA : state.cardUsageLogB;

        const fakeState = {
            player, enemy: opponent,
            turn: 0, phase: 'mulligan'
        };

        const indices = aiStrategy(fakeState, this, 'mulligan');
        if (!indices || indices.length === 0) return;

        const temp = [];
        const discardedNames = [];
        const sorted = [...indices].sort((a, b) => b - a);
        for (const idx of sorted) {
            if (idx >= 0 && idx < player.hand.length) {
                const card = player.hand.splice(idx, 1)[0];
                temp.push(card);
                discardedNames.push(card.name);
            }
        }

        const drawnCards = this._drawCards(player, temp.length, 'Mulligan', usageLog);
        if (usageLog && discardedNames.length > 0) {
            usageLog.push({
                type: 'mulligan',
                discarded: discardedNames,
                drawn: drawnCards
            });
        }

        player.drawPile.push(...temp);
        this._shuffleArray(player.drawPile);
    }

    _mirrorPlayerTurn(state, side, aiStrategy, turnEntry) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;
        const usageLog = side === 'A' ? state.cardUsageLogA : state.cardUsageLogB;

        // 턴 시작 초기화
        // 에너지 이월 처리
        if (player.energyCarryOver) {
            const carried = Math.min(player.energy || 0, player.maxEnergyPool || 10);
            player.energy = player.baseEnergy - (player.overloadNext || 0) - (player.energyDrainNext || 0) + carried;
            player.energy = Math.min(player.energy, player.maxEnergyPool || 10);
        } else {
            player.energy = player.baseEnergy - (player.overloadNext || 0) - (player.energyDrainNext || 0);
        }
        if (player.energy < 0) player.energy = 0;
        // 전력 재분배 등: 이전 턴에 예약된 에너지 적용
        if (player.energyNextTurn > 0) {
            player.energy += player.energyNextTurn;
            player.energyNextTurn = 0;
        }
        player.overloadNext = 0;
        player.energyDrainNext = 0;
        player.selfDamageThisTurn = 0;
        player.dismantledThisTurn = 0;
        player._hasDismantledThisTurn = false;
        player.cardsPlayedThisTurn = 0;
        player.networkStacks = 0;
        player.networkCardsPlayedThisTurn = 0;
        player.totalDamageThisTurn = 0;
        player.lastPlayedCard = null;
        player.protocolBypassCount = 0;
        player.forceEndTurn = false;
        player.luckyThisTurn = 0;
        player.unluckyThisTurn = 0;
        player.gambleBonusChance = 0;
        player.gambleChanceSumThisTurn = 0;
        player.ignoreUnluck = false;
        player._insuranceActive = false;
        player.consecutiveLuck = 0;
        player.extractEnergyBonusLeft = 0; // 무한 동력 수배 버프 리셋
        if (player.weakness > 0) player.weakness -= 1;

        // 턴 시작 정보 로깅
        usageLog.push({ type: 'phase', name: `=== Turn ${state.turn} Start ===` });
        usageLog.push({ type: 'info', msg: `Hand: ${player.hand.map(c => c.name).join(', ')}` });

        // 부식 처리 (미러전)
        if (player.corrosion > 0) {
            this.applyDamage(player, player.corrosion, null, true);
            player.corrosion -= 1;
            usageLog.push({ type: 'status', effect: `Corrosion Damage: ${player.corrosion + 1}` });
        }
        // 드로우
        const drawTarget = player.baseDraw + player.extraDraw;
        const toDraw = Math.max(0, drawTarget - player.hand.length);
        this._drawCards(player, toDraw, 'Turn Start Draw', usageLog);

        const fakeState = {
            player, enemy: opponent,
            turn: state.turn, phase: 'action'
        };

        // 파워 효과 (턴 시작)
        this._applyPowerEffects(fakeState, player, opponent, 'turnStart', usageLog);

        // 오버클럭 감소
        if (player.overclockStacks > 0) player.overclockStacks--;

        // AI 행동
        let actions = 0;
        while (actions < 20 && !state.winner) {
            if (player.forceEndTurn) break;
            const decision = aiStrategy(fakeState, this);
            if (!decision || decision.action === 'end_turn') break;

            if (decision.action === 'play_card') {
                const ci = decision.cardIndex;
                if (ci >= 0 && ci < player.hand.length) {
                    const card = player.hand[ci];
                    if (card && player.energy >= card.cost) {
                        const oppHpBefore = opponent.hp;
                        const oppShieldBefore = opponent.shield;
                        const playerHpBefore = player.hp;

                        this._mirrorPlayCard(state, side, ci, usageLog);

                        // 턴 로그에 행동 기록
                        turnEntry.actions.push({
                            side,
                            cardName: card.name,
                            cardId: card.id,
                            cardCost: card.cost,
                            cardType: card.type,
                            damageDone: Math.max(0, oppHpBefore - opponent.hp) + Math.max(0, oppShieldBefore - opponent.shield),
                            selfHpChange: player.hp - playerHpBefore,
                            shieldGained: Math.max(0, player.shield - (playerHpBefore === player.hp ? 0 : 0)), // 간략화
                            oppHpAfter: opponent.hp,
                            playerHpAfter: player.hp
                        });
                    } else break;
                } else break;
            }
            actions++;
        }

        // 턴 종료 시 정보 로깅
        usageLog.push({ type: 'info', msg: `Turn End Hand: ${player.hand.map(c => c.name).join(', ')}` });

        // 파워 효과 (턴 종료)
        this._applyPowerEffects(fakeState, player, opponent, 'turnEnd', usageLog);
        this._checkPowerTriggers(fakeState, player, opponent, 'turnEnd', null, usageLog);

        // 턴 종료 지연 버리기 (카드 효과에서 등록된 addEndOfTurnDiscard)
        if (player.pendingEndOfTurnDiscards > 0) {
            const count = Math.min(player.pendingEndOfTurnDiscards, player.hand.length);
            for (let i = 0; i < count; i++) {
                if (player.hand.length > 0) {
                    const idx = Math.floor(Math.random() * player.hand.length);
                    const discarded = player.hand.splice(idx, 1)[0];
                    player.void = player.void || [];
                    player.void.push(discarded);
                    if (usageLog) usageLog.push({ type: 'effect', source: '지연효과', effect: `턴종료 버림: ${discarded.name}` });
                }
            }
            player.pendingEndOfTurnDiscards = 0;
        }

        // 임시 카드(_tempCard) 턴 종료 시 영구 소멸 (시스템 롤백 미사용 카드)
        for (let i = player.hand.length - 1; i >= 0; i--) {
            if (player.hand[i]._tempCard) {
                const c = player.hand.splice(i, 1)[0];
                player.void = player.void || [];
                player.void.push(c);
                if (usageLog) usageLog.push({ type: 'effect', source: '임시카드', effect: `영구 소멸: ${c.name}` });
            }
        }
    }

    _mirrorPlayCard(state, side, cardIndex, usageLog) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;
        const card = player.hand[cardIndex];
        if (!card) return;

        player.energy -= card.cost;
        player.cardsPlayedThisTurn++;

        if (card.keywords?.includes('overclock')) {
            player.overclockStacks = Math.min(
                (player.overclockStacks || 0) + 1,
                player.overclockMax
            );
        }

        player.hand.splice(cardIndex, 1);

        const ctx = {
            state: {
                player, enemy: opponent, turn: state.turn, phase: 'action',
                cardUsageLog: usageLog, turnLog: state.turnLog
            },
            caster: player,
            target: opponent,
            card,
            engine: this,
            overclockScale: card.keywords?.includes('overclock') ? player.overclockStacks : 0,
            _dmgFlags: { strengthApplied: false }, // 힘/약화 카드당 1회 적용 추적
            // 영구 기관 코어: 오버클럭 카드 디메리트 스택 고정
            ...(card.keywords?.includes('overclock') && this.hasPower(player, 'fixedDemerit')
                ? { demeritOCScale: player.activePowers.find(pw => pw.powerEffect?.type === 'fixedDemerit').powerEffect.value ?? 3 }
                : {})
        };

        for (const effect of (card.effects || [])) {
            ctx.effect = effect;
            this.effectRegistry.execute(effect.type, ctx);
        }

        // 축적(accumulation) 판정 및 효과 발동
        if (card.keywords && card.keywords.includes('accumulation') && card.accumulationTarget && card.accumulationEffects) {
            if ((card.accumulationStack || 0) >= card.accumulationTarget) {
                for (const aEffect of card.accumulationEffects) {
                    ctx.effect = aEffect;
                    this.effectRegistry.execute(aEffect.type, ctx);
                }
            }
        }

        // 네트워크 카드이면 스택 증가 (이펙트 처리 후)
        if (card.keywords?.includes('network')) {
            const stackGain = player.doubleNetworkStacks ? 2 : 1;
            player.networkStacks = (player.networkStacks || 0) + stackGain;
            player.networkCardsPlayedThisTurn = (player.networkCardsPlayedThisTurn || 0) + 1;
            player.networkCardsPlayedThisBattle = (player.networkCardsPlayedThisBattle || 0) + 1;
        }

        // 파워 트리거 (카드 사용 직후)
        this._checkPowerTriggers(ctx.state, player, opponent, 'cardPlayed', card, usageLog);

        // 프로토콜 조건 판정 및 효과 발동
        if (card.protocolCondition && (card.protocolEffects || card.protocolElseEffects)) {
            const protocolMet = this._checkProtocolCondition(
                player.lastPlayedCard, card.protocolCondition, player
            );
            if (protocolMet) {
                for (const pEffect of (card.protocolEffects || [])) {
                    ctx.effect = pEffect;
                    this.effectRegistry.execute(pEffect.type, ctx);
                }
            } else {
                for (const pEffect of (card.protocolElseEffects || [])) {
                    ctx.effect = pEffect;
                    this.effectRegistry.execute(pEffect.type, ctx);
                }
            }
        }

        // 마지막 카드 기록
        player.lastPlayedCard = card;

        if (card.type === 'power') {
            player.activePowers.push(this._cloneCard(card));
            if (card.powerEffect) {
                this._applyMirrorImmediatePower(player, card.powerEffect);
            }
        }

        usageLog.push({
            turn: state.turn,
            cardId: card.id,
            cardName: card.name,
            pack: card.pack,
            rarity: card.rarity,
            playerHpAfter: player.hp,
            enemyHpAfter: opponent.hp
        });

        // 재구축
        if (card.keywords?.includes('rebuild') && card.rebuildCount > 0) {
            const rebuilt = this._cloneCard(card);
            rebuilt.rebuildCount--;
            rebuilt.rebuildCount += player.rebuildBonuses || 0;
            if (rebuilt.rebuildCount > 0) {
                player.hand.push(rebuilt);
                player.totalRebuildsThisBattle++;
                this._triggerRebuildPower(player, rebuilt, usageLog);
                this._growRebuildCards(player, usageLog);
            } else {
                player.void.push(card);
            }
        } else if (card.type !== 'power') {
            player.void.push(card);
        }

        // 승패 체크
        if (opponent.hp <= 0) {
            state.winner = side;
        }
        if (player.hp <= 0) {
            const revive = player.activePowers.find(pw => pw.powerEffect?.type === 'reviveOnce' && !pw._revived);
            if (revive) {
                revive._revived = true;
                player.hp = Math.floor(player.maxHp * (revive.powerEffect.value / 100));
            } else {
                state.winner = side === 'A' ? 'B' : 'A';
            }
        }
    }

    // (기존 _applyMirrorPowerEffects 등 중복 함수 제거됨 - _applyPowerEffects 로 통합)

    _applyMirrorImmediatePower(player, pe) {
        if (pe.type === 'extraDraw') player.extraDraw += pe.value;
        if (pe.type === 'extraEnergy') player.baseEnergy += pe.value;
        if (pe.type === 'rebuildBonus') player.rebuildBonuses += pe.value;
        if (pe.type === 'permanentNetworkBuff') {
            player.networkDamageBuff = (player.networkDamageBuff || 0) + pe.damage;
            player.networkShieldBuff = (player.networkShieldBuff || 0) + pe.shield;
        }
        if (pe.type === 'doubleNetworkStacks') {
            player.doubleNetworkStacks = true;
        }
        if (pe.type === 'energyCarryOver') {
            player.energyCarryOver = true;
            player.maxEnergyPool = pe.maxEnergy || 10;
        }
    }
}