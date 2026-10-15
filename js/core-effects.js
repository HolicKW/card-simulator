import { roundToInt, hasKeyword } from './battle-rules.js';
import { registerGambleSuccess, applyBankruptcyRerollPenalty } from './effects-bio-gamble.js';

const positiveInt = (value, minimum = 1) => Math.max(minimum, Math.trunc(value || 0));

function effectContext(engine, card, entity) {
    return engine.makeContext(entity, entity.opponent, card, null);
}

function executeCoreEffects(engine, card, entity) {
    if (entity.opponent && card.coreEffect?.effects) {
        engine.executeEffects(card.coreEffect.effects, effectContext(engine, card, entity));
    }
}

const immediateHandlers = {
    extraDraw: (engine, card, entity) => { entity.extraDraw += positiveInt(card.coreEffect.value); },
    extraEnergy: (engine, card, entity) => { entity.baseEnergy += positiveInt(card.coreEffect.value); },
    rebuildBonus: (engine, card, entity) => { entity.rebuildBonuses += positiveInt(card.coreEffect.value); },
    permanentNetworkBuff: (engine, card, entity) => {
        const bonus = positiveInt(card.coreEffect.value);
        entity.networkDmgBonus += bonus;
        entity.networkShieldBonus += bonus;
    },
    doubleNetworkStacks: (engine, card, entity) => { entity.doubleNetworkStacks = true; },
    extraRebuildCount: (engine, card, entity) => {
        const bonus = positiveInt(card.coreEffect.value);
        for (const next of [...entity.drawPile, ...entity.hand]) {
            if (next.rebuildCount > 0 || hasKeyword(next, 'rebuild')) next.rebuildCount = (next.rebuildCount || 0) + bonus;
        }
    },
    energyCarryOver: (engine, card, entity) => { entity.energyCarryOver = true; },
    removeOverclockLimit: (engine, card, entity) => { entity.overclockUnlimited = true; },
    fixedDemerit: (engine, card, entity) => { entity.fixedOverclockStacks = positiveInt(card.coreEffect.value); },
    bankruptcy: () => {},
};

const customHandlers = {
    virusFarmDamage: (engine, core, entity) => {
        const damage = roundToInt(entity.opponent.virus * (core.coreEffect.value > 0 ? core.coreEffect.value : 0.25));
        if (damage > 0) engine.applyDamage(entity.opponent, damage, entity);
    },
    autoVirus: (engine, core, entity) => {
        const amount = positiveInt(core.coreEffect.value);
        entity.opponent.virus += amount;
        engine.notifyVirusApplied(entity, entity.opponent, amount);
    },
    autoCorrosion: (engine, core, entity) => { entity.opponent.corrosion += positiveInt(core.coreEffect.value); },
    overclockPerTurn: (engine, core, entity) => {
        const eff = core.coreEffect;
        const cost = eff.energyCost > 0 ? Math.trunc(eff.energyCost) : 1;
        if (entity.energy < cost) return;
        entity.energy -= cost;
        if (entity.overclockUnlimited || entity.overclockStacks < entity.overclockMax) {
            entity.overclockStacks += positiveInt(eff.value);
        }
    },
    absoluteCarrier: (engine, core, entity) => {
        const eff = core.coreEffect;
        entity.opponent.virus += eff.maxBonusStack > 0 ? eff.maxBonusStack : positiveInt(eff.value);
        entity.opponent.corrosion += positiveInt(eff.value);
    },
    randomBuffStart: (engine, core, entity) => {
        const eff = core.coreEffect;
        if (eff.chance > 0) {
            const baseChance = eff.chance > 1 ? eff.chance / 100 : eff.chance;
            const chance = Math.min(1, Math.max(0, baseChance + entity.luck * 0.01 + (entity.turn.gambleBonusChance || 0) * 0.01));
            entity.turn.gambleBonusChance = 0;
            let success = Math.random() < chance;
            const bankruptcyCore = !success && entity.activeCores.find((card) => card.coreEffect?.coreType === 'bankruptcyReroll');
            if (bankruptcyCore) {
                success = Math.random() < chance;
                if (!success) applyBankruptcyRerollPenalty(entity, bankruptcyCore);
            }
            if (success) registerGambleSuccess(entity);
            else if (!entity.ignoreUnluck) {
                entity.turn.unluckyThisTurn = (entity.turn.unluckyThisTurn || 0) + 1;
                entity.unluckyThisBattle = (entity.unluckyThisBattle || 0) + 1;
                entity.consecutiveLuck = 0;
            }
            engine.notifyGambleResult(entity, success, effectContext(engine, core, entity));
            if (!success) return;
        }
        switch (Math.floor(Math.random() * 3)) {
            case 0: entity.strength += eff.value > 0 ? roundToInt(eff.value) : 5; break;
            case 1: entity.energy += eff.energy > 0 ? eff.energy : 2; break;
            case 2: engine.drawCards(entity, eff.draw > 0 ? eff.draw : 3); break;
        }
    },
    strengthPerLuck: (engine, core, entity) => { entity.strength += entity.luck; },
    berserkMode: (engine, core, entity) => {
        const eff = core.coreEffect;
        const threshold = eff.threshold > 0 ? eff.threshold : 30;
        if (entity.maxHp <= 0 || entity.hp > entity.maxHp * threshold / 100) return;
        entity.strength += eff.value > 0 ? roundToInt(eff.value) : 10;
        entity.energy += eff.energy > 0 ? eff.energy : 2;
        engine.drawCards(entity, eff.draw > 0 ? eff.draw : 2);
    },
    healOnHighOverclock: (engine, core, entity) => {
        if (entity.overclockStacks >= 3) entity.hp = Math.min(entity.hp + positiveInt(core.coreEffect.value, 5), entity.maxHp);
    },
    extraDebuffReduction: (engine, core, entity) => { entity.shield += core.coreEffect.shield > 0 ? core.coreEffect.shield : 15; },
    strengthOnManyCards: (engine, core, entity) => {
        const threshold = core.coreEffect.threshold > 0 ? core.coreEffect.threshold : 3;
        if (entity.turn.cardsPlayedThisTurn > 0 && entity.turn.cardsPlayedThisTurn % threshold === 0) entity.strength += positiveInt(core.coreEffect.value);
    },
    damageOnSelfDamage: (engine, core, entity) => {
        if (entity.turn.selfDamageThisTurn <= 0) return;
        const amount = roundToInt(entity.turn.selfDamageThisTurn * (core.coreEffect.value > 0 ? core.coreEffect.value : 1));
        if (amount > 0) engine.applyDamage(entity.opponent, amount, entity);
    },
    madGearBothDamage: (engine, core, entity) => {
        const amount = entity.overclockStacks;
        if (amount <= 0) return;
        engine.applyDamage(entity, amount, entity.opponent);
        engine.applyDamage(entity.opponent, amount, entity);
    },
    shieldOnOverclock: (engine, core, entity, card) => {
        if (hasKeyword(card, 'overclock')) entity.shield += positiveInt(core.coreEffect.value, 5);
    },
    energyOnCardCount: (engine, core, entity) => {
        // The live handler uses value as its divisor, not the JSON thresholds array.
        if (entity.turn.cardsPlayedThisTurn % positiveInt(core.coreEffect.value) === 0) entity.energy++;
    },
    fullCommitDamage: (engine, core, entity) => {
        engine.applyDamage(entity.opponent, core.coreEffect.damage > 0 ? core.coreEffect.damage : positiveInt(core.coreEffect.value), entity);
    },
    drawOnNetworkThreshold: (engine, core, entity, card) => {
        if (hasKeyword(card, 'network') && entity.turn.networkCardsPlayedThisTurn > 0 && entity.turn.networkCardsPlayedThisTurn % 3 === 0) engine.drawCards(entity, 1);
    },
    doubleThirdNetwork: () => {}, // CardPlayProcessor applies the multiplier before effects.
    damageAndShieldOnProtocol: (engine, core, entity) => {
        const eff = core.coreEffect;
        const damage = eff.damage > 0 ? eff.damage : positiveInt(eff.value, 5);
        entity.shield += eff.shield > 0 ? eff.shield : damage;
        engine.applyDamage(entity.opponent, damage, entity);
    },
    doubleFirstSkill: (engine, core, entity, card) => {
        if (card?.type !== 'skill' || entity.turn.skillsPlayedThisTurn !== 1 || !card.effects?.length) return;
        engine.executeEffects(card.effects, effectContext(engine, card, entity));
    },
    rouletteMaster: () => {},
    energyOnFirstLuck: (engine, core, entity) => {
        if (entity.turn.luckyThisTurn <= 0 || entity.turn.luckyEnergyGainedThisTurn) return;
        entity.turn.luckyEnergyGainedThisTurn = true;
        entity.luck++;
        entity.energy++;
    },
    drawOnLuckyChance: () => {},
    damageOnDismantle: (engine, core, entity) => { engine.applyDamage(entity.opponent, positiveInt(core.coreEffect.value), entity); },
    drawOnDismantle: (engine, core, entity) => {
        const eff = core.coreEffect;
        const threshold = eff.threshold > 0 ? eff.threshold : eff.value > 0 ? Math.trunc(eff.value) : 1;
        if (threshold > 0 && entity.dismantledThisBattle % threshold === 0) engine.drawCards(entity, 1);
    },
    energyAndDrawOnFirstDismantle: (engine, core, entity) => {
        if (entity.turn.dismantledThisTurn !== 1) return;
        entity.energy += core.coreEffect.energy > 0 ? core.coreEffect.energy : 1;
        engine.drawCards(entity, core.coreEffect.draw > 0 ? core.coreEffect.draw : 1);
    },
    healAndCostReductionOnRebuild: (engine, core, entity, card) => {
        const eff = core.coreEffect;
        entity.hp = Math.min(entity.hp + (eff.heal > 0 ? eff.heal : 20), entity.maxHp);
        if (card && eff.costReduction > 0) card.cost = Math.max(0, card.cost - eff.costReduction);
    },
    damageOnRebuild: (engine, core, entity) => {
        const eff = core.coreEffect;
        const amount = roundToInt(entity.totalRebuildsThisBattle * (eff.multiplier > 0 ? eff.multiplier : eff.value || 0));
        if (amount > 0) engine.applyDamage(entity.opponent, amount, entity);
    },
    bioWeaponVault: () => {},
    immuneSystemTakeover: () => {},
    absoluteCarrierEnergy: () => {},
};

export function hasCoreHandler(type) {
    return Object.prototype.hasOwnProperty.call(immediateHandlers, type)
        || Object.prototype.hasOwnProperty.call(customHandlers, type)
        || type === 'viralLab' || type === 'bankruptcyReroll';
}

export function applyImmediateCore(engine, card, entity) {
    const eff = card.coreEffect;
    if (!eff || (eff.trigger && eff.trigger !== 'immediate')) return;
    const handler = immediateHandlers[eff.coreType];
    if (handler) handler(engine, card, entity);
    else executeCoreEffects(engine, card, entity);
}

export function applyCoreEffects(engine, timing, entity) {
    checkCoreTriggers(engine, timing, entity);
}

export function checkCoreTriggers(engine, event, entity, card = null) {
    for (const core of [...(entity.activeCores || [])]) {
        const eff = core.coreEffect;
        if (!eff || eff.trigger !== event) continue;
        if (eff.coreType && !entity.opponent) continue;
        engine.logEffect?.(entity, core.name || core.cardName, `코어 발동: ${event}`);
        const handler = eff.coreType && customHandlers[eff.coreType];
        if (handler) handler(engine, core, entity, card);
        else executeCoreEffects(engine, core, entity);
    }
}

// The engine owns virus counters; these callbacks only dispatch core effects.
export function notifyVirusApplied(engine, caster, target, amount) {
    for (const core of [...(caster.activeCores || [])]) {
        if (core.coreEffect?.trigger !== 'virusApplied') continue;
        if (core.coreEffect.coreType === 'viralLab') target.virus++;
        else executeCoreEffects(engine, core, caster);
    }
}

export function notifyVirusConsumed(engine, caster, amount) {
    for (const core of [...(caster.activeCores || [])]) {
        const eff = core.coreEffect;
        if (!eff?.coreType || (eff.trigger !== 'virusConsumed' && eff.coreType !== 'absoluteCarrier')) continue;
        const bonus = Math.max(1, roundToInt(amount * (eff.value > 0 ? eff.value : 0.5)));
        switch (eff.coreType) {
            case 'bioWeaponVault': caster.strength += bonus; break;
            case 'immuneSystemTakeover': caster.shield += bonus; break;
            case 'absoluteCarrier':
            case 'absoluteCarrierEnergy': caster.energy++; break;
            default: executeCoreEffects(engine, core, caster); break;
        }
    }
}

export function notifyGambleResult(engine, caster, success, ctx) {
    for (const core of caster.activeCores || []) {
        const eff = core.coreEffect;
        if (eff?.coreType === 'drawOnLuckyChance') {
            if (!success) continue;
            let chance = eff.value > 0 ? eff.value : 0.33;
            if (chance > 1) chance /= 100;
            if (Math.random() < Math.min(1, Math.max(0, chance))) engine.drawCards(caster, 1);
        } else if (eff?.coreType === 'rouletteMaster') {
            caster.luck += success ? eff.value > 0 ? Math.max(1, roundToInt(eff.value)) : 2 : Math.max(1, ctx?.card?.cost ?? 1);
        }
    }
}
