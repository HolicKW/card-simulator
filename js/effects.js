/** Runtime port of NewWorld EffectInterpreter and its registered aliases. */
import { roundToInt, hasKeyword, cloneCard } from './battle-rules.js';
import { registerBioGambleEffects, resolveGamble } from './effects-bio-gamble.js';

const v = e => e.value ?? 0;
const n = (entity, key) => entity?.[key] ?? 0;
const turn = entity => entity.turn ??= {};
const tv = (entity, key) => turn(entity)[key] ?? 0;
const add = (entity, key, value) => { entity[key] = n(entity, key) + value; };
const addTurn = (entity, key, value) => { turn(entity)[key] = tv(entity, key) + value; };
const randomIndex = count => Math.floor(Math.random() * count);
const targetOf = ctx => ctx.effect.target === 'self' ? ctx.caster : ctx.target;
const ocVal = ctx => ctx.effect.overclockScale && ctx.overclockScale > 0 ? v(ctx.effect) * ctx.overclockScale : v(ctx.effect);

export class EffectRegistry {
    constructor() { this.handlers = new Map(); }
    register(type, handler) { this.handlers.set(type, handler); }
    has(type) { return this.handlers.has(type); }
    execute(type, ctx) {
        const handler = this.handlers.get(type);
        if (!handler) throw new Error(`[EffectRegistry] Unregistered effect: ${type}`);
        handler(ctx);
    }
    executeAll(effects, ctx) {
        if (effects == null) return;
        ctx.depth = (ctx.depth ?? 0) + 1;
        if (ctx.depth > 10) {
            ctx.depth--;
            console.warn('[EffectRegistry] Maximum effect nesting depth (10) exceeded.');
            return;
        }
        try {
            for (const effect of effects) {
                if (ctx.engine?.isBattleEnded?.(ctx.caster)) break;
                ctx.effect = effect;
                this.execute(effect.type, ctx);
                if (ctx.abortRemainingEffects) { ctx.abortRemainingEffects = false; break; }
            }
        } finally { ctx.depth--; }
    }
}

export function matchesFilter(card, filter) {
    if (!card) return false;
    if (['network', 'overclock', 'extract', 'virus'].includes(filter)) return hasKeyword(card, filter);
    if (filter === 'attack') return card.type === 'attack';
    if (filter === 'skill') return card.type === 'skill';
    if (filter === 'core') return card.type === 'power';
    if (filter === 'coreOrSkill') return card.type === 'power' || card.type === 'skill';
    return false;
}

export function getScalingSourceValue(source, ctx) {
    const c = ctx.caster, t = ctx.target;
    switch (source) {
        case 'networkStacks': return n(c, 'networkStacks');
        case 'networkStacksWithSelf': return n(c, 'networkStacks') + (c.doubleNetworkStacks ? 2 : 1);
        case 'overclockStacks': return n(c, 'overclockStacks');
        case 'selfDamageThisTurn': case 'totalDamageThisTurn': case 'dismantledThisTurn':
        case 'luckyThisTurn': case 'unluckyThisTurn': case 'gambleSuccessThisTurn': return tv(c, source);
        case 'dismantledThisBattle': case 'luck': case 'hp': case 'maxHp': case 'baseEnergy':
        case 'luckyThisBattle': case 'unluckyThisBattle': return n(c, source);
        case 'targetVirus': return n(t, 'virus');
        case 'targetHandCount': return t?.hand?.length ?? 0;
        case 'corrosion': return n(t, 'corrosion');
        case 'enemyMaxHp': return n(t, 'maxHp');
        case 'overflowStacks': return n(c, 'overflowNext');
        case 'rebuildCount': return n(c, 'totalRebuildsThisBattle');
        case 'hpDifference': return Math.abs(n(c, 'hp') - n(t, 'hp'));
        case 'overclockConsumed': return ctx.overclockConsumed ?? 0;
        case 'energyConsumed': return ctx.energyConsumed ?? 0;
        case 'nonBaseCardsInHand': return c.hand.filter(card => card.pack !== 'base').length;
        case 'targetLostHp': return n(t, 'maxHp') - n(t, 'hp');
        case 'cardAccumCount': return ctx.card?.accumulationCount ?? 0;
        default: console.warn(`[EffectRegistry] Unregistered scaling source: ${source}`); return 0;
    }
}

export function computeScalingValue(scaling, ctx) {
    return scaling == null ? 0 : getScalingSourceValue(scaling.source, ctx) * (scaling.multiplier ?? 0);
}

function effectScalingSource(effect, ctx) {
    if (!effect.scaling) return 0;
    const fixedDemerit = effect.action === 'selfDamage' || (effect.stat === 'overflowNext' && effect.target === 'self');
    if (fixedDemerit && effect.scaling.source === 'overclockStacks' && ctx.caster.fixedOverclockStacks > 0)
        return ctx.caster.fixedOverclockStacks;
    return getScalingSourceValue(effect.scaling.source, ctx);
}

export function evaluateCondition(condition, ctx) {
    const c = ctx.caster, t = ctx.target, value = condition.value ?? 0;
    switch (condition.type) {
        case 'hpBelow': return c.hp <= c.maxHp * value / 100;
        case 'hpAbove': return c.hp >= c.maxHp * value / 100;
        case 'targetHpBelow': return t.hp <= t.maxHp * value / 100;
        case 'overclockMin': return n(c, 'overclockStacks') >= Math.trunc(value);
        case 'virusMin': case 'virusTarget': return n(t, 'virus') >= Math.trunc(value);
        case 'virusAppliedThisTurnMin': return tv(t, 'virusAppliedThisTurn') >= Math.trunc(value);
        case 'corrosionMin': return n(t, 'corrosion') >= Math.trunc(value);
        case 'shieldZero': return n(t, 'shield') === 0;
        case 'cardsPlayedThisTurn': return tv(c, 'cardsPlayedThisTurn') >= Math.trunc(value);
        case 'networkCardsPlayed': return tv(c, 'networkCardsPlayedThisTurn') >= Math.trunc(value);
        case 'dismantledThisTurn': return tv(c, 'dismantledThisTurn') >= Math.trunc(value);
        case 'dismantledThisBattle': return n(c, 'dismantledThisBattle') >= Math.trunc(value);
        case 'handEmpty': return c.hand.length === 0;
        case 'enemyHasWeakness': return n(t, 'weakness') > 0;
        case 'luckMin': return n(c, 'luck') >= Math.trunc(value);
        case 'consecutiveLuckMin': return n(c, 'consecutiveLuck') >= Math.trunc(value);
        case 'nonBaseCardsInHand': return c.hand.filter(card => card.pack !== 'base').length >= Math.trunc(value);
        case 'gambleSuccessThisTurn': return tv(c, 'gambleSuccessThisTurn') >= Math.trunc(value);
        case 'corrosionTarget': return n(t, 'corrosion') > 0;
        case 'accumulationMet': return ctx.card != null && (ctx.card.accumulationCount ?? 0) >= (ctx.card.accumulationTarget ?? 0);
        case 'accumulation': return ctx.card != null && (ctx.card.accumulationCount ?? 0) >= Math.trunc(value);
        default: console.warn(`[EffectRegistry] Unregistered condition: ${condition.type}`); return false;
    }
}

const booleanStats = new Set(['doubleNetworkStacks', 'energyCarryOver', 'overclockUnlimited']);
const nonnegativeStats = new Set(['shield', 'weakness', 'virus', 'corrosion', 'overclockStacks', 'overflowNext', 'luck', 'networkStacks']);
const supportedStats = new Set(['hp', 'maxHp', 'shield', 'energy', 'baseEnergy', 'strength', 'weakness', 'virus', 'corrosion',
    'overclockStacks', 'overflowNext', 'luck', 'consecutiveLuck', 'networkStacks', 'extraDraw', 'rebuildBonuses', ...booleanStats]);
function getStat(entity, stat) {
    if (stat === 'gambleBonusChance') return tv(entity, stat);
    if (booleanStats.has(stat)) return entity[stat] ? 1 : 0;
    return supportedStats.has(stat) ? n(entity, stat) : 0;
}
function setStat(entity, stat, value) {
    if (stat === 'gambleBonusChance') { turn(entity)[stat] = value; return; }
    if (!supportedStats.has(stat)) { console.warn(`[EffectRegistry] Unsupported modifyStat stat: ${stat}`); return; }
    if (booleanStats.has(stat)) entity[stat] = value !== 0;
    else if (stat === 'maxHp') entity[stat] = Math.max(1, value);
    else entity[stat] = nonnegativeStats.has(stat) ? Math.max(0, value) : value;
}
function modifyStat(entity, stat, value, mode) {
    const current = getStat(entity, stat);
    const next = mode === 'set' ? roundToInt(value) : mode === 'multiply' ? roundToInt(current * value) : current + roundToInt(value);
    setStat(entity, stat, next);
    if (stat === 'maxHp' && entity.hp > entity.maxHp) entity.hp = entity.maxHp;
    if (stat === 'hp') entity.hp = Math.max(0, Math.min(entity.hp, entity.maxHp));
}
function drawCards(ctx, entity, count) {
    if (ctx.engine) return ctx.engine.drawCards(entity, count);
    for (let i = 0; i < count && entity.drawPile.length && entity.hand.length < 10; i++) {
        const card = entity.drawPile.shift(); entity.hand.push(card); entity.lastDrawnCard = card;
    }
}
function enqueue(ctx, timing, effect, card = ctx.card) {
    if (ctx.engine?.enqueueDeferred) return ctx.engine.enqueueDeferred({ ...ctx, card }, timing, effect);
    (ctx.caster.deferredActions ??= []).push({ timing, effect, caster: ctx.caster, target: ctx.target, card });
}
function attackDamage(ctx, baseDamage, hits = 1) {
    let damage = baseDamage;
    if (!ctx.strengthApplied) { damage += n(ctx.caster, 'strength') - n(ctx.caster, 'weakness'); ctx.strengthApplied = true; }
    if (tv(ctx.caster, 'nextAttackBonus') > 0) { damage += tv(ctx.caster, 'nextAttackBonus'); turn(ctx.caster).nextAttackBonus = 0; }
    if (tv(ctx.caster, 'nextDamageMultiplier') > 0) { damage *= tv(ctx.caster, 'nextDamageMultiplier'); turn(ctx.caster).nextDamageMultiplier = 0; }
    if (ctx.cardDamageMultiplier > 0) damage *= ctx.cardDamageMultiplier;
    damage = Math.max(1, roundToInt(damage));
    const pierce = Boolean(ctx.effect.bypassShield || turn(ctx.caster).armorPierceNextAttack);
    turn(ctx.caster).armorPierceNextAttack = false;
    for (let i = 0; i < hits; i++) ctx.engine.applyDamage(ctx.target, damage, ctx.caster, pierce);
}
function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]];
    }
}

export function registerCoreEffects(registry) {
    const all = (effects, ctx) => registry.executeAll(effects, ctx);
    const as = (type, ctx, fields = {}) => { Object.assign(ctx.effect, fields); registry.execute(type, ctx); };
    const single = (ctx, effect) => {
        const previous = ctx.effect; ctx.effect = effect;
        try { registry.execute(effect.type, ctx); } finally { ctx.effect = previous; }
    };

    registry.register('damage', ctx => attackDamage(ctx, ocVal(ctx), ctx.effect.hits > 0 ? ctx.effect.hits : 1));
    registry.register('fixedDamage', ctx => {
        const value = roundToInt(v(ctx.effect));
        if (value > 0) ctx.engine.applyDamage(targetOf(ctx), value, ctx.caster, Boolean(ctx.effect.bypassShield));
    });
    registry.register('shield', ctx => add(ctx.caster, 'shield', roundToInt(v(ctx.effect))));
    registry.register('modifyStat', ctx => {
        const e = ctx.effect, entity = targetOf(ctx), mode = e.mode ?? 'add';
        let value = v(e);
        if (e.source) value = getScalingSourceValue(e.source, ctx);
        else if (e.scaling) {
            value += effectScalingSource(e, ctx) * (e.scaling.multiplier ?? 0);
            if (e.scaling.max > 0) value = Math.min(value, e.scaling.max);
            if (e.scaling.min > 0) value = Math.max(value, e.scaling.min);
        }
        const virusBefore = n(entity, 'virus');
        modifyStat(entity, e.stat, value, mode);
        if (e.stat === 'virus' && mode !== 'set' && mode !== 'multiply' && n(entity, 'virus') > virusBefore)
            ctx.engine?.notifyVirusApplied(ctx.caster, entity, entity.virus - virusBefore);
    });
    registry.register('scaledEffect', ctx => {
        const e = ctx.effect, scaling = e.scaling;
        if (!scaling) throw new Error('[EffectRegistry] scaledEffect requires scaling data.');
        let computed = v(e) + effectScalingSource(e, ctx) * (scaling.multiplier ?? 0);
        if (scaling.max > 0) computed = Math.min(computed, scaling.max);
        if (scaling.min > 0) computed = Math.max(computed, scaling.min);
        const value = roundToInt(computed);
        if (value <= 0 && e.action !== 'modifyStat') return;
        const saved = { value: e.value, overclockScale: e.overclockScale, mode: e.mode, source: e.source };
        Object.assign(e, { value, overclockScale: false, mode: null, source: null });
        try {
            const action = e.action || 'damage';
            if (action === 'modifyStat') e.mode = saved.mode;
            if (!['damage', 'shield', 'heal', 'draw', 'selfDamage', 'energy', 'modifyStat'].includes(action))
                throw new Error(`[EffectRegistry] Unsupported scaled action: ${action}`);
            registry.execute(action, ctx);
        } finally { Object.assign(e, saved); }
    });
    registry.register('conditional', ctx => {
        const e = ctx.effect;
        if (e.condition) all(evaluateCondition(e.condition, ctx) ? e.thenEffects : e.elseEffects, ctx);
    });
    registry.register('selfDamage', ctx => {
        const e = ctx.effect;
        const value = e.mode === 'targetShield' ? n(ctx.target, 'shield')
            : e.mode === 'percent' ? roundToInt(ctx.caster.maxHp * v(e) / 100) : roundToInt(ocVal(ctx));
        ctx.engine.applySelfDamage(ctx.caster, value);
    });
    registry.register('dismantle', ctx => {
        const e = ctx.effect, c = ctx.caster, source = e.source ?? 'hand';
        const cards = source === 'deck' ? c.drawPile : c.hand;
        const count = e.countAll ? cards.length : Math.max(1, roundToInt(v(e)));
        if (count <= 0 || !cards.length) return;
        let actual = Math.min(count, cards.length);
        const pending = ctx.engine?.pendingDismantleTargets;
        if (e.mode === 'chosen' && pending) actual = Math.min(actual, pending.length);
        const dismantled = [];
        for (let i = 0; i < actual && cards.length; i++) {
            let index;
            if (e.filter) index = cards.findIndex(card => matchesFilter(card, e.filter));
            else if (source === 'deck') index = 0;
            else if (e.mode === 'chosen' && pending?.length) index = cards.indexOf(pending.shift());
            else index = randomIndex(cards.length);
            if (index < 0) break;
            const [card] = cards.splice(index, 1);
            if (ctx.engine) ctx.engine.applyRebuildOrVoid(c, card); else c.voidPile.push(card);
            dismantled.push(card);
        }
        addTurn(c, 'dismantledThisTurn', dismantled.length); add(c, 'dismantledThisBattle', dismantled.length);
        if (dismantled.length) {
            if (e.bonus === 'drawEqual') drawCards(ctx, c, dismantled.length);
            else if (e.bonus === 'shieldScale') add(c, 'shield', roundToInt(dismantled.length * (e.bonusMultiplier > 0 ? e.bonusMultiplier : 10)));
            else if (e.bonus === 'energyByCost') {
                for (const card of dismantled) add(c, 'energy', card.cost);
                drawCards(ctx, c, 1);
            }
        }
        for (const card of dismantled) {
            if (card.extractEffects?.length) {
                const previousCard = ctx.card; ctx.card = card;
                try { all(card.extractEffects, ctx); } finally { ctx.card = previousCard; }
            }
            if (turn(c).extractEnergyBonusActive && c.extractEnergyAmount > 0 && tv(c, 'extractEnergyRemainingCount') > 0) {
                add(c, 'energy', c.extractEnergyAmount); turn(c).extractEnergyRemainingCount--;
            }
        }
        for (const card of dismantled) ctx.engine?.checkCoreTriggers('dismantle', c, card);
    });

    registry.register('heal', ctx => {
        const value = ctx.effect.mode === 'percent' ? roundToInt(ctx.caster.maxHp * v(ctx.effect) / 100) : roundToInt(v(ctx.effect));
        ctx.caster.hp = Math.min(ctx.caster.hp + value, ctx.caster.maxHp);
    });
    registry.register('draw', ctx => {
        let count = roundToInt(ocVal(ctx));
        if (ctx.caster.skipNextDrawCount > 0) {
            const skip = Math.min(count, ctx.caster.skipNextDrawCount); ctx.caster.skipNextDrawCount -= skip; count -= skip;
        }
        drawCards(ctx, ctx.caster, count);
    });
    registry.register('energy', ctx => {
        const value = roundToInt(ocVal(ctx));
        if (ctx.effect.timing === 'nextTurn') enqueue(ctx, 'nextTurnStart', { type: 'energy', value });
        else add(ctx.caster, 'energy', value);
    });
    registry.register('shieldBreak', ctx => {
        const e = ctx.effect, t = ctx.target;
        if (e.mode === 'allAndDamage') {
            const destroyed = t.shield; t.shield = 0;
            const value = roundToInt(destroyed * (e.fraction ?? 0));
            if (value > 0) ctx.engine.applyDamage(t, value, ctx.caster);
        } else t.shield = Math.max(0, t.shield - roundToInt(v(e)));
    });
    registry.register('convertResource', ctx => {
        const e = ctx.effect, c = ctx.caster, sourceAmount = getStat(c, e.from);
        if (sourceAmount <= 0) return;
        const value = roundToInt(sourceAmount * (e.ratio > 0 ? e.ratio : 1)); setStat(c, e.from, 0);
        if (e.to === 'energy') add(c, 'energy', value);
        else if (e.to === 'heal') c.hp = Math.min(c.hp + value, c.maxHp);
        else if (e.to === 'draw') drawCards(ctx, c, value);
        else if (e.to === 'shield') add(c, 'shield', value);
        else modifyStat(c, e.to, value, 'add');
    });
    registry.register('stealShield', ctx => {
        const e = ctx.effect;
        const stolen = e.mode === 'all' ? ctx.target.shield : e.mode === 'half' ? Math.trunc(ctx.target.shield / 2)
            : Math.min(roundToInt(v(e)), ctx.target.shield);
        ctx.target.shield -= stolen;
        if (e.mode !== 'half' || e.gain) add(ctx.caster, 'shield', stolen);
    });
    registry.register('discard', ctx => {
        const e = ctx.effect, hand = ctx.caster.hand;
        if (e.timing === 'turnEnd') { enqueue(ctx, 'turnEnd', cloneCard(e)); return; }
        const count = e.countAll ? hand.length : Math.min(roundToInt(v(e)), hand.length);
        for (let i = 0; i < count && hand.length; i++) ctx.caster.voidPile.push(hand.splice(e.mode === 'random' ? randomIndex(hand.length) : hand.length - 1, 1)[0]);
    });
    registry.register('searchDeck', ctx => {
        const e = ctx.effect, c = ctx.caster, pile = c.drawPile;
        if (!pile.length) return;
        const maxFind = Math.max(1, roundToInt(v(e)));
        if (e.filter === 'highestCost') {
            const revealed = [];
            for (let i = 0, count = Math.min(maxFind, pile.length); i < count; i++) revealed.push(pile.splice(randomIndex(pile.length), 1)[0]);
            let highest = 0;
            for (let i = 1; i < revealed.length; i++) if (revealed[i].cost > revealed[highest].cost) highest = i;
            const [chosen] = revealed.splice(highest, 1); chosen.cost = 0;
            (c.hand.length < 10 ? c.hand : c.voidPile).push(chosen);
            for (const card of revealed) pile.unshift(card);
        } else for (let i = pile.length - 1, found = 0; i >= 0 && found < maxFind && c.hand.length < 10; i--) {
            if (!matchesFilter(pile[i], e.filter)) continue;
            const [card] = pile.splice(i, 1);
            if (e.costMode === 'zeroCost') card.cost = 0; else if (e.costMode === 'reduce') card.cost = Math.max(0, card.cost - 1);
            c.hand.push(card); found++;
        }
    });

    registry.register('overclockGain', ctx => {
        const c = ctx.caster, gain = roundToInt(v(ctx.effect));
        c.overclockStacks = c.overclockUnlimited ? n(c, 'overclockStacks') + gain : Math.min(n(c, 'overclockStacks') + gain, c.overclockMax ?? 4);
    });
    registry.register('overclockConsume', ctx => {
        const c = ctx.caster, e = ctx.effect, consumed = n(c, 'overclockStacks');
        c.overclockStacks = 0; ctx.overclockConsumed = consumed;
        if (consumed <= 0) return;
        const value = roundToInt(consumed * (v(e) > 0 ? v(e) : 1));
        if (e.action === 'damage' && value > 0) ctx.engine.applyDamage(ctx.target, value, c);
        else if (e.action === 'shield') add(c, 'shield', value);
        else if (e.action === 'heal') c.hp = Math.min(c.hp + value, c.maxHp);
        all(e.effects, ctx);
    });
    registry.register('overload', ctx => { const e = ctx.effect; all(n(ctx.caster, 'overclockStacks') >= roundToInt(v(e)) ? e.thenEffects : e.elseEffects, ctx); });
    registry.register('preventSelfDamage', ctx => { turn(ctx.caster).preventNextSelfDamage = true; });
    registry.register('extract', ctx => {
        const c = ctx.caster; all(ctx.card?.extractEffects, ctx);
        if (turn(c).extractEnergyBonusActive && c.extractEnergyAmount > 0 && tv(c, 'extractEnergyRemainingCount') > 0) {
            add(c, 'energy', c.extractEnergyAmount); turn(c).extractEnergyRemainingCount--;
        }
    });
    // C# HandleRebuild is empty: the engine applies rebuild after play and dismantle.
    registry.register('rebuild', () => {});
    registry.register('threadSync', ctx => {
        const c = ctx.caster, hand = c.hand;
        if (!hand.length) return;
        const targets = []; let totalCost;
        if (hand.length === 1) { targets.push(hand[0]); totalCost = hand[0].cost; }
        else {
            let highest = 0, lowest = 0;
            for (let i = 1; i < hand.length; i++) {
                if (hand[i].cost > hand[highest].cost) highest = i;
                if (hand[i].cost < hand[lowest].cost) lowest = i;
            }
            targets.push(hand[highest]); if (highest !== lowest) targets.push(hand[lowest]);
            totalCost = hand[highest].cost + hand[lowest].cost;
        }
        for (const card of targets) hand.splice(hand.indexOf(card), 1);
        if (ctx.engine) for (const card of targets) ctx.engine.dismantleCard(c, card, 'hand');
        else { c.voidPile.push(...targets); addTurn(c, 'dismantledThisTurn', targets.length); add(c, 'dismantledThisBattle', targets.length); }
        const damage = roundToInt(totalCost * (v(ctx.effect) > 0 ? v(ctx.effect) : n(c, 'networkStacks')));
        if (damage > 0) ctx.engine.applyDamage(ctx.target, damage, c);
    });
    registry.register('masterOverride', ctx => {
        const c = ctx.caster, pile = c.drawPile; let highest = -1;
        for (let i = 0; i < pile.length; i++) {
            if (!['attack', 'skill'].includes(pile[i].type)) continue;
            if (highest < 0 || pile[i].cost > pile[highest].cost) highest = i;
        }
        if (highest < 0) return;
        const [card] = pile.splice(highest, 1); ctx.engine.executeRemoteCard(card, c, ctx.target, ctx);
        if (!c.hand.includes(card)) { c.hand.push(card); c.lastDrawnCard = card; }
    });
    registry.register('setupExtractEnergy', ctx => {
        const c = ctx.caster;
        if (!turn(c).extractEnergyBonusActive) { turn(c).extractEnergyBonusActive = true; c.extractEnergyAmount = 1; }
        turn(c).extractEnergyRemainingCount = Math.max(tv(c, 'extractEnergyRemainingCount'), roundToInt(v(ctx.effect)));
    });
    registry.register('protocolBypass', ctx => add(ctx.caster, 'protocolBypassCount', Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('nextProtocolShieldBonus', ctx => add(ctx.caster, 'nextProtocolShieldBonus', Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('nextProtocolEffectRepeat', ctx => add(ctx.caster, 'nextProtocolEffectRepeat', Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('armorPierce', ctx => { turn(ctx.caster).armorPierceNextAttack = true; });
    registry.register('costReduceHandCards', ctx => {
        const e = ctx.effect, hand = ctx.caster.hand, reduction = roundToInt(v(e));
        if (e.mode === 'random' && hand.length) {
            const cards = hand.filter(card => !e.filter || matchesFilter(card, e.filter));
            for (let i = 0, count = Math.min(2, cards.length); i < count; i++) {
                const index = i + randomIndex(cards.length - i); [cards[i], cards[index]] = [cards[index], cards[i]];
                cards[i].cost = Math.max(0, cards[i].cost - reduction);
            }
        } else for (const card of hand) if (!e.filter || matchesFilter(card, e.filter)) card.cost = Math.max(0, e.mode === 'set' ? reduction : card.cost - reduction);
    });

    registerBioGambleEffects(registry);

    registry.register('forceTurnEnd', ctx => { ctx.caster.forceEndTurn = true; });
    registry.register('returnToHandZeroCost', ctx => {
        if (!ctx.card || ctx.caster.hand.length >= 10) return;
        ctx.card.cost = 0; if (!ctx.caster.hand.includes(ctx.card)) ctx.caster.hand.push(ctx.card);
    });
    registry.register('reshuffleAndDraw', ctx => {
        const c = ctx.caster; c.drawPile.push(...c.hand); c.hand.length = 0; shuffle(c.drawPile);
        drawCards(ctx, c, Math.max(1, roundToInt(v(ctx.effect))));
    });
    registry.register('adjustCostLastDrawn', ctx => {
        const c = ctx.caster, card = c.lastDrawnCard;
        if (card && c.hand.includes(card)) card.cost = Math.max(0, ctx.effect.mode === 'set' ? roundToInt(v(ctx.effect)) : card.cost + roundToInt(v(ctx.effect)));
    });
    registry.register('randomBuff', ctx => {
        const value = Math.max(1, roundToInt(v(ctx.effect))), roll = randomIndex(3);
        if (roll === 0) add(ctx.caster, 'strength', value); else if (roll === 1) add(ctx.caster, 'energy', value); else drawCards(ctx, ctx.caster, value);
    });
    registry.register('casinoFieldReset', ctx => {
        const e = ctx.effect;
        for (const entity of [ctx.caster, ctx.target]) entity.weakness = entity.virus = entity.corrosion = entity.shield = 0;
        const ratio = v(e) > 0 ? v(e) : 0.5;
        const heal = entity => { entity.hp = Math.min(entity.hp + roundToInt(entity.maxHp * ratio), entity.maxHp); };
        if (e.chance > 0) {
            const success = resolveGamble(ctx, e.chance); heal(ctx.caster);
            if (!success && !turn(ctx.caster).lastGambleUnluckSoftened) heal(ctx.target);
        } else { heal(ctx.caster); heal(ctx.target); }
    });
    registry.register('gambleDebt', ctx => {
        let debt = 0;
        for (const card of ctx.caster.hand) if (card.pack === 'russian_roulette' || hasKeyword(card, 'gamble')) { debt += card.cost; card.cost = 0; }
        add(ctx.caster, 'turnEndHpPenalty', v(ctx.effect) > 0 ? roundToInt(v(ctx.effect)) : debt);
    });
    registry.register('discardTopAndShield', ctx => {
        const c = ctx.caster; if (!c.drawPile.length) return;
        const card = c.drawPile.shift(); c.voidPile.push(card);
        const value = roundToInt(card.cost * Math.max(1, n(c, 'luck')) * (v(ctx.effect) > 0 ? v(ctx.effect) : 1));
        if (value > 0) add(c, 'shield', value);
    });
    registry.register('dismantleVoidRecall', ctx => {
        const c = ctx.caster, previous = c.voidPile.length, count = c.hand.length;
        c.voidPile.push(...c.hand); c.hand.length = 0; addTurn(c, 'dismantledThisTurn', count); add(c, 'dismantledThisBattle', count);
        if (previous > 0) c.hand.push(c.voidPile.splice(previous - 1, 1)[0]);
    });
    registry.register('conditionalByDismantledType', ctx => {
        const e = ctx.effect, pile = ctx.caster.voidPile;
        if (pile.length) all(!e.filter || matchesFilter(pile[pile.length - 1], e.filter) ? e.thenEffects : e.elseEffects, ctx);
    });
    registry.register('energyDrain', ctx => add(ctx.target, 'energyDrainNext', Math.max(0, roundToInt(v(ctx.effect)))));
    registry.register('drainEnergy', ctx => registry.execute('energyDrain', ctx));
    registry.register('consumeAllEnergy', ctx => {
        const e = ctx.effect, consumed = ctx.caster.energy; ctx.caster.energy = 0; ctx.energyConsumed = consumed;
        if (consumed <= 0) return;
        if (e.effects != null) { for (const effect of e.effects) effect.value = consumed * (v(effect) > 0 ? v(effect) : 1); all(e.effects, ctx); }
        else all(e.thenEffects, ctx);
    });
    registry.register('drawPerEnergy', ctx => drawCards(ctx, ctx.caster, ctx.caster.energy * Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('drawAndZeroCost', ctx => {
        const c = ctx.caster, before = c.hand.length; drawCards(ctx, c, Math.max(1, roundToInt(v(ctx.effect))));
        for (let i = before; i < c.hand.length; i++) {
            const card = c.hand[i], originalCost = card.cost; card.cost = 0;
            enqueue(ctx, 'turnEnd', { type: 'restoreCardCost', value: originalCost }, card);
        }
    });
    registry.register('diceRollCombo', ctx => {
        const e = ctx.effect, die1 = randomIndex(6) + 1, die2 = randomIndex(6) + 1, sum = die1 + die2;
        if (die1 === die2) { if (e.thenEffects != null) all(e.thenEffects, ctx); else single(ctx, { type: 'draw', value: die1 }); }
        else if (e.effects != null && sum - 2 < e.effects.length) single(ctx, e.effects[sum - 2]);
        else if (e.elseEffects != null) all(e.elseEffects, ctx); else single(ctx, { type: 'damage', value: sum });
    });
    registry.register('gambleDeathCross', ctx => {
        const e = ctx.effect, difference = Math.abs(ctx.caster.hp - ctx.target.hp);
        if (resolveGamble(ctx, e.chance > 0 ? e.chance : 0.5)) {
            const value = roundToInt(difference * (v(e) > 0 ? v(e) : 1));
            if (value > 0) ctx.engine.applyDamage(ctx.target, value, ctx.caster); all(e.thenEffects, ctx);
        } else if (!turn(ctx.caster).lastGambleUnluckSoftened) {
            if (e.ratio > 0) ctx.engine.applySelfDamage(ctx.caster, roundToInt(difference * e.ratio)); all(e.elseEffects, ctx);
        }
    });
    registry.register('conditionalAdd', ctx => { const e = ctx.effect; all(!e.condition || evaluateCondition(e.condition, ctx) ? e.thenEffects : e.elseEffects, ctx); });
    registry.register('broadcastDebuffs', ctx => {
        const weakness = Math.max(0, n(ctx.caster, 'weakness')), virus = Math.max(0, n(ctx.caster, 'virus')), corrosion = Math.max(0, n(ctx.caster, 'corrosion'));
        add(ctx.target, 'weakness', weakness); add(ctx.target, 'virus', virus); add(ctx.target, 'corrosion', corrosion);
        if (virus > 0) ctx.engine?.notifyVirusApplied(ctx.caster, ctx.target, virus);
    });
    registry.register('drawBothSides', ctx => { const count = Math.max(1, roundToInt(ocVal(ctx))); drawCards(ctx, ctx.caster, count); drawCards(ctx, ctx.target, count); });
    registry.register('kernelPanicDamage', ctx => {
        const maximum = Math.max(1, roundToInt(v(ctx.effect))); if (ctx.caster.maxHp <= 0) return;
        attackDamage(ctx, Math.max(1, Math.min(maximum, roundToInt(maximum * (ctx.caster.maxHp - ctx.caster.hp) / ctx.caster.maxHp))));
    });
    registry.register('openAccessDraw', ctx => {
        const c = ctx.caster; let filter = ctx.effect.filter || ctx.openAccessFilter || ctx.engine?.pendingOpenAccessFilter;
        if (!filter) {
            const attacks = c.drawPile.filter(card => card.type === 'attack').length, skills = c.drawPile.filter(card => card.type === 'skill').length;
            const cores = c.drawPile.filter(card => card.type === 'power').length;
            filter = attacks >= skills && attacks >= cores ? 'attack' : skills >= cores ? 'skill' : 'core';
        }
        const before = c.hand.length; drawCards(ctx, c, 1);
        if (c.hand.length > before && matchesFilter(c.hand[c.hand.length - 1], filter)) single(ctx, { type: 'searchDeck', value: 1, filter });
    });
    for (const [type, timing, action] of [['energyNextTurn', 'nextTurnStart', 'energy'], ['nextTurnShield', 'nextTurnStart', 'shield'],
        ['nextTurnSelfDamage', 'nextTurnStart', 'selfDamage'], ['selfDamageAtTurnEnd', 'turnEnd', 'selfDamage']])
        registry.register(type, ctx => enqueue(ctx, timing, { type: action, value: roundToInt(ocVal(ctx)) }));
    registry.register('returnToHandNextTurn', ctx => enqueue(ctx, 'nextTurnStart', { type: 'returnToHandZeroCost' }));
    registry.register('addEndOfTurnDiscard', ctx => { const e = ctx.effect; enqueue(ctx, 'turnEnd', { type: 'discard', value: v(e), mode: e.mode, countAll: e.countAll }); });

    for (const [type, stat, target] of [['strength', 'strength', 'self'], ['weakness', 'weakness', 'enemy'], ['virus', 'virus', 'enemy'],
        ['selfWeakness', 'weakness', 'self'], ['overflow', 'overflowNext', 'self'], ['addLuck', 'luck', 'self'], ['addExtraDraw', 'extraDraw', 'self']])
        registry.register(type, ctx => as('modifyStat', ctx, { stat, target }));
    registry.register('tempStrength', ctx => {
        const value = roundToInt(v(ctx.effect)); add(ctx.caster, 'strength', value);
        enqueue(ctx, 'turnEnd', { type: 'modifyStat', stat: 'strength', target: 'self', value: -value });
    });
    registry.register('corrosion', ctx => as('modifyStat', ctx, { stat: 'corrosion', target: ctx.effect.target || 'enemy' }));
    registry.register('virusOnCardPlayedNextTurn', ctx => add(ctx.target, 'virusOnCardPlayedNextTurn', Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('overflowReduce', ctx => as('modifyStat', ctx, { stat: 'overflowNext', target: 'self', value: -v(ctx.effect) }));
    registry.register('overclockReduce', ctx => {
        const required = roundToInt(Math.abs(v(ctx.effect)));
        if (n(ctx.caster, 'overclockStacks') < required) { ctx.abortRemainingEffects = true; return; }
        as('modifyStat', ctx, { stat: 'overclockStacks', target: 'self', value: -required });
    });
    registry.register('overclockReset', ctx => as('modifyStat', ctx, { stat: 'overclockStacks', target: 'self', mode: 'set', value: 0 }));
    registry.register('maxHpReduce', ctx => as('modifyStat', ctx, { stat: 'maxHp', target: 'self', value: -Math.abs(v(ctx.effect)) }));
    registry.register('doubleLuck', ctx => as('modifyStat', ctx, { stat: 'luck', target: 'self', mode: 'multiply', value: 2 }));
    registry.register('loseAllLuck', ctx => as('modifyStat', ctx, { stat: 'luck', target: 'self', mode: 'set', value: 0 }));
    registry.register('doubleVirus', ctx => as('modifyStat', ctx, { stat: 'virus', target: 'enemy', mode: 'multiply', value: 2 }));
    registry.register('removeOverclockLimit', ctx => as('modifyStat', ctx, { stat: 'overclockUnlimited', target: 'self', mode: 'set', value: 1 }));
    for (const [type, action] of [['scaledDamage', 'damage'], ['scaledDraw', 'draw'], ['scaledShield', 'shield'], ['scaledHeal', 'heal'],
        ['scaledSelfDamage', 'selfDamage'], ['scaledSelfDamagePercent', 'selfDamage']]) registry.register(type, ctx => as('scaledEffect', ctx, { action }));
    registry.register('scaledSelfWeakness', ctx => as('scaledEffect', ctx, { action: 'modifyStat', stat: 'weakness', target: 'self' }));
    registry.register('scaledMaxHpReduce', ctx => as('scaledEffect', ctx, { action: 'modifyStat', stat: 'maxHp' }));
    registry.register('healPercent', ctx => as('heal', ctx, { mode: 'percent' }));
    registry.register('endTurn', ctx => registry.execute('forceTurnEnd', ctx));
    registry.register('discardAll', ctx => as('discard', ctx, { countAll: true }));
    registry.register('discardRandom', ctx => as('discard', ctx, { mode: 'random' }));
    registry.register('selfDamageByTargetShield', ctx => as('selfDamage', ctx, { mode: 'targetShield' }));
    registry.register('shieldBreakAllAndDamage', ctx => as('shieldBreak', ctx, { mode: 'allAndDamage' }));
    registry.register('casinoRoyalFieldReset', ctx => registry.execute('casinoFieldReset', ctx));
    registry.register('retryGambleOnUnluck', ctx => registry.execute('retryOnUnluck', ctx));
    registry.register('softenNextUnluck', ctx => { turn(ctx.caster).softenNextUnluckPenalty = Math.max(1, roundToInt(v(ctx.effect))); });
    registry.register('luckyDayDebt', ctx => Object.assign(turn(ctx.caster), { luckyDayDebtActive: true, luckyDayLuckPerSuccess: Math.max(1, roundToInt(v(ctx.effect))),
        luckyDayHpLossPerSuccess: Math.max(1, roundToInt(ctx.effect.bonusMultiplier ?? 0)), luckyDaySuccessCount: 0 }));
    registry.register('dismantleAllAndScaleDraw', ctx => as('dismantle', ctx, { countAll: true, bonus: 'drawEqual' }));
    registry.register('dismantleAllAndScaleShield', ctx => as('dismantle', ctx, { countAll: true, bonus: 'shieldScale' }));
    registry.register('dismantleForEnergy', ctx => as('dismantle', ctx, { bonus: 'energyByCost' }));
    registry.register('dismantleNetworkAndDraw', ctx => as('dismantle', ctx, { filter: 'network', countAll: true, bonus: 'drawEqual' }));
    registry.register('dismantleTop', ctx => as('dismantle', ctx, { source: 'deck' }));
    registry.register('extractTopOrDraw', ctx => {
        const c = ctx.caster, count = Math.max(1, roundToInt(v(ctx.effect)));
        for (let i = 0; i < count && c.drawPile.length; i++) {
            const card = c.drawPile[0], extract = card.extractEffects?.length > 0;
            if (!extract && c.hand.length >= 10) break;
            c.drawPile.shift();
            if (extract) ctx.engine.dismantleCard(c, card, 'deck'); else { c.hand.push(card); c.lastDrawnCard = card; }
        }
    });
    registry.register('diceRollLuck', ctx => add(ctx.caster, 'luck', randomIndex(6) + 1));
    registry.register('costReduceAttackCards', ctx => as('costReduceHandCards', ctx, { filter: 'attack' }));
    registry.register('searchByType', ctx => registry.execute('searchDeck', ctx));
    registry.register('revealAndTakeHighestCost', ctx => as('searchDeck', ctx, { filter: 'highestCost' }));
    registry.register('cloneHandCard', ctx => {
        const c = ctx.caster, e = ctx.effect, count = Math.max(1, roundToInt(v(e)));
        for (let i = 0; i < count && c.hand.length < 10; i++) {
            let source;
            if (e.mode === 'chosen' && ctx.engine?.pendingDismantleTargets?.length) {
                source = ctx.engine.pendingDismantleTargets.shift();
                if (!c.hand.includes(source) || (e.filter && !matchesFilter(source, e.filter))) source = null;
            }
            if (!source) {
                const candidates = c.hand.filter(card => card !== ctx.card && (!e.filter || matchesFilter(card, e.filter)));
                source = candidates.length ? candidates[randomIndex(candidates.length)] : null;
            }
            if (!source) break;
            const clone = cloneCard(source); clone.id = `${source.id}_TEMP_CLONE`; clone.isTemporary = true; clone.keywords ??= [];
            if (!clone.keywords.includes('일시적')) clone.keywords.push('일시적'); c.hand.push(clone); c.lastDrawnCard = clone;
        }
    });
    registry.register('diceRollShieldDamage', ctx => {
        const roll = randomIndex(6) + 1; add(ctx.caster, 'shield', roll); ctx.engine.applyDamage(ctx.target, roll, ctx.caster);
        const bonus = roundToInt(v(ctx.effect)); if (roll === 6 && bonus > 0) add(ctx.caster, 'luck', bonus);
    });
    registry.register('selfDamagePercent', ctx => as('selfDamage', ctx, { mode: 'percent' }));
    registry.register('energyFromShield', ctx => as('convertResource', ctx, { from: 'shield', to: 'energy' }));
    registry.register('energyToHeal', ctx => as('convertResource', ctx, { from: 'energy', to: 'heal' }));
    registry.register('energyFromShieldChunk', ctx => {
        const size = Math.max(1, roundToInt(v(ctx.effect))), chunks = Math.trunc(ctx.caster.shield / size);
        if (chunks > 0) { ctx.caster.shield -= chunks * size; add(ctx.caster, 'energy', chunks); }
    });
    registry.register('damageIfHandEmpty', ctx => { if (!ctx.caster.hand.length) ctx.engine.applyDamage(ctx.target, Math.max(1, roundToInt(v(ctx.effect))), ctx.caster); });
    registry.register('damageIfConsecutiveLuck', ctx => {
        if (ctx.caster.consecutiveLuck >= 1) { const value = roundToInt(v(ctx.effect) * ctx.caster.consecutiveLuck); if (value > 0) ctx.engine.applyDamage(ctx.target, value, ctx.caster); }
    });
    for (const [type, source] of [['damagePlusByLuckyThisBattle', 'luckyThisBattle'], ['damagePlusByUnluckyThisBattle', 'unluckyThisBattle'], ['damageByLuckStack', 'luck']])
        registry.register(type, ctx => { ctx.effect.scaling ??= { source, multiplier: 1 }; as('scaledEffect', ctx, { action: 'damage' }); });
    registry.register('nextGambleBonusChance', ctx => { turn(ctx.caster).gambleBonusChance = Math.max(tv(ctx.caster, 'gambleBonusChance'), Math.max(0, roundToInt(v(ctx.effect)))); });
    registry.register('zeroCostHandCard', ctx => as('costReduceHandCards', ctx, { mode: 'set', value: 0 }));
    registry.register('costReductionRandom', ctx => as('costReduceHandCards', ctx, { mode: 'random' }));
    registry.register('restoreMaxEnergy', ctx => as('modifyStat', ctx, { stat: 'energy', target: 'self', source: 'baseEnergy', mode: 'set' }));
    registry.register('discardTopAndGainShieldByCost', ctx => registry.execute('discardTopAndShield', ctx));
    registry.register('damageMaxPercent', ctx => {
        const e = ctx.effect; let value = roundToInt(ctx.target.maxHp * v(e) / 100);
        if (e.scaling?.max > 0) value = Math.min(value, e.scaling.max); if (e.scaling?.min > 0) value = Math.max(value, e.scaling.min);
        if (value > 0) ctx.engine.applyDamage(ctx.target, value, ctx.caster);
    });
    registry.register('lostHpDamageByOverclock', ctx => {
        const e = ctx.effect, lost = Math.max(0, ctx.target.maxHp - ctx.target.hp);
        const rate = v(e) + (e.scaling ? computeScalingValue(e.scaling, ctx) : 0); let value = roundToInt(lost * rate);
        if (e.scaling?.max > 0) value = Math.min(value, e.scaling.max); if (e.scaling?.min > 0) value = Math.max(value, e.scaling.min);
        if (value > 0) attackDamage(ctx, value);
    });
    registry.register('damageIfUnluckyThisTurn', ctx => { const value = roundToInt(v(ctx.effect)); if (tv(ctx.caster, 'unluckyThisTurn') > 0 && value > 0) ctx.engine.applyDamage(ctx.target, value, ctx.caster); });
    registry.register('restoreCardCost', ctx => { if (ctx.card) ctx.card.cost = roundToInt(v(ctx.effect)); });
    registry.register('shieldByHpPercent', ctx => { const value = roundToInt(ctx.caster.maxHp * v(ctx.effect) / 100); if (value > 0) add(ctx.caster, 'shield', value); });
    registry.register('shieldByLastHpLoss', ctx => { add(ctx.caster, 'shield', Math.max(0, tv(ctx.caster, 'lastHpLoss'))); turn(ctx.caster).lastHpLoss = 0; });
    registry.register('damageReduction', ctx => { turn(ctx.caster).damageReductionThisTurn = v(ctx.effect) / 100; });
    registry.register('invincible', ctx => { turn(ctx.caster).invincibleThisTurn = true; });
    registry.register('evadeNextHit', ctx => addTurn(ctx.caster, 'evadeNextHits', Math.max(1, roundToInt(v(ctx.effect)))));
    registry.register('nextAttackBonus', ctx => addTurn(ctx.caster, 'nextAttackBonus', roundToInt(v(ctx.effect))));
    registry.register('retaliateOnHit', ctx => { const value = roundToInt(v(ctx.effect)); if (value > 0) addTurn(ctx.caster, 'retaliateOnHitDamage', value); });
    registry.register('virusByDebuff', ctx => { const value = roundToInt((n(ctx.target, 'weakness') + n(ctx.target, 'corrosion')) * v(ctx.effect)); if (value > 0) add(ctx.target, 'virus', value); });
    registry.register('costReductionPerOverclock', ctx => {
        const reduction = n(ctx.caster, 'overclockStacks') * roundToInt(v(ctx.effect)); if (reduction > 0) for (const card of ctx.caster.hand) card.cost = Math.max(0, card.cost - reduction);
    });
    registry.register('setHpScale', ctx => { ctx.caster.hp = Math.max(0, Math.min(ctx.caster.maxHp, roundToInt(ctx.caster.hp * v(ctx.effect)))); });
    registry.register('setHpScaleStoreLoss', ctx => { const before = ctx.caster.hp; registry.execute('setHpScale', ctx); turn(ctx.caster).lastHpLoss = Math.max(0, before - ctx.caster.hp); });
    registry.register('setEnemyHpScale', ctx => { ctx.target.hp = Math.max(0, Math.min(ctx.target.maxHp, roundToInt(ctx.target.hp * v(ctx.effect)))); });
    registry.register('dismantleAllAndVoidRecall', ctx => {
        const c = ctx.caster; (c.rollbackStoredHand ??= []).push(...c.hand); c.hand.length = 0;
        const count = ctx.effect.recallCount > 0 ? ctx.effect.recallCount : 1;
        for (let i = 0; i < count && c.voidPile.length && c.hand.length < 10; i++) { const card = c.voidPile.pop(); card.isTemporary = true; c.hand.push(card); }
    });
    registry.register('preventSelfDamageIfOverclock', ctx => { if (n(ctx.caster, 'overclockStacks') >= (ctx.effect.threshold > 0 ? ctx.effect.threshold : 1)) turn(ctx.caster).preventNextSelfDamage = true; });
}
