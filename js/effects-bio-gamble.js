import { roundToInt } from './battle-rules.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const activeCore = (entity, type) =>
    entity.activeCores?.find((card) => card.coreEffect?.coreType === type);

// These helpers also serve the separate randomBuffStart core path. That path in
// NewWorld does not use retryOnUnluck, insurance, or softenNextUnluck.
export function registerGambleSuccess(caster) {
    const turn = caster.turn;
    turn.luckyThisTurn = (turn.luckyThisTurn || 0) + 1;
    caster.luckyThisBattle = (caster.luckyThisBattle || 0) + 1;
    caster.consecutiveLuck = (caster.consecutiveLuck || 0) + 1;
    turn.gambleSuccessThisTurn = (turn.gambleSuccessThisTurn || 0) + 1;

    if (turn.luckyDayDebtActive) {
        caster.luck += Math.max(1, turn.luckyDayLuckPerSuccess || 0);
        turn.luckyDaySuccessCount = (turn.luckyDaySuccessCount || 0) + 1;
    }
}

export function applyBankruptcyRerollPenalty(caster, core) {
    let rate = core.coreEffect.value > 0 ? core.coreEffect.value : 0.25;
    if (rate > 1) rate /= 100;
    const hpBefore = caster.hp;
    caster.hp = Math.max(0, caster.hp - roundToInt(caster.hp * clamp01(rate)));
    caster.turn.selfDamageThisTurn = (caster.turn.selfDamageThisTurn || 0) + hpBefore - caster.hp;
}

/**
 * Resolve one final gamble result using EffectInterpreter.ResolveGamble rules.
 * Returns a boolean. It consumes the next-roll bonus, updates gamble counters,
 * and sets caster.turn.lastGambleUnluckSoftened for the caller's failure branch.
 * The engine callback receives the original effect context plus gambleChance
 * (percent) and gamblePhase ('firstRoll', 'reroll', or 'softened').
 */
export function resolveGamble(ctx, baseChance) {
    const caster = ctx.caster;
    const turn = caster.turn;
    turn.lastGambleUnluckSoftened = false;
    if (baseChance > 1) baseChance /= 100;
    const chance = clamp01(baseChance + (caster.luck || 0) * 0.01 + (turn.gambleBonusChance || 0) * 0.01);
    turn.gambleBonusChance = 0;

    let success = Math.random() < chance;
    let rerolled = false;
    if (success) {
        registerGambleSuccess(caster);
    } else if (turn.retryOnUnluckFlag) {
        turn.retryOnUnluckFlag = false;
        rerolled = true;
        success = Math.random() < chance;
        if (success) registerGambleSuccess(caster);
    }

    const bankruptcyCore = !success && activeCore(caster, 'bankruptcyReroll');
    if (bankruptcyCore) {
        rerolled = true;
        success = Math.random() < chance;
        if (success) registerGambleSuccess(caster);
        else applyBankruptcyRerollPenalty(caster, bankruptcyCore);
    }

    if (!success && !caster.ignoreUnluck) {
        turn.unluckyThisTurn = (turn.unluckyThisTurn || 0) + 1;
        caster.unluckyThisBattle = (caster.unluckyThisBattle || 0) + 1;
        caster.consecutiveLuck = 0;
        if (turn.buffInsuranceValue > 0) caster.shield += turn.buffInsuranceValue;
        if (turn.buffInsuranceLuckValue > 0) caster.luck += turn.buffInsuranceLuckValue;
    }

    if (!success && turn.softenNextUnluckPenalty > 0) {
        caster.luck = Math.max(0, caster.luck - turn.softenNextUnluckPenalty);
        turn.softenNextUnluckPenalty = 0;
        turn.lastGambleUnluckSoftened = true;
    }

    const gamblePhase = rerolled ? 'reroll' : turn.lastGambleUnluckSoftened ? 'softened' : 'firstRoll';
    ctx.engine?.logEffect?.(caster, ctx.card?.name || ctx.card?.cardName || '도박',
        `도박 ${success ? '성공' : '실패'} (${roundToInt(chance * 100)}%, 행운 ${caster.luck})${rerolled ? ' · 재판정' : ''}${turn.lastGambleUnluckSoftened ? ' · 실패 효과 무시' : ''}`);
    ctx.engine?.notifyGambleResult?.(caster, success, { ...ctx, gambleChance: chance * 100, gamblePhase });
    return success;
}

export function registerBioGambleEffects(registry) {
    const execute = (effects, ctx) => {
        if (effects) ctx.engine.executeEffects(effects, ctx);
    };

    registry.register('consumeVirus', (ctx) => {
        const { effect: eff, target, caster, engine } = ctx;
        if (eff.threshold > 0 && target.virus < eff.threshold) return;

        const consumed = eff.countAll || eff.mode === 'all'
            ? target.virus
            : eff.threshold > 0 ? eff.threshold : Math.min(roundToInt(eff.value || 0), target.virus);
        if (consumed <= 0) return;
        target.virus -= consumed;

        let action = eff.action || '';
        if (!action && eff.ratio > 0) action = 'damage';
        const amount = roundToInt(consumed * (eff.ratio > 0 ? eff.ratio : 1));
        switch (action) {
            case 'damage':
                if (amount > 0) engine.applyDamage(target, amount, caster);
                break;
            case 'shield': caster.shield += amount; break;
            case 'shieldAndHealByChunk': {
                const chunkSize = Math.max(1, eff.minValue > 0 ? eff.minValue : 5);
                const healPerChunk = Math.max(1, roundToInt(eff.bonusMultiplier > 0 ? eff.bonusMultiplier : 1));
                caster.shield += amount;
                const healAmount = Math.trunc(consumed / chunkSize) * healPerChunk;
                if (healAmount > 0) engine.heal(caster, healAmount);
                break;
            }
            case 'heal': caster.hp = Math.min(caster.hp + amount, caster.maxHp); break;
            case 'strength': caster.strength += amount; break;
            case 'draw': engine.drawCards(caster, roundToInt(eff.value || 0)); break;
            case 'energy': caster.energy += roundToInt(eff.value || 0); break;
        }

        execute(eff.effects, ctx);
        engine.notifyVirusConsumed(caster, consumed);
    });

    registry.register('damageByDebuff', (ctx) => {
        const stacks = ctx.effect.stat === 'corrosion' ? ctx.target.corrosion : ctx.target.virus;
        const amount = roundToInt(stacks * (ctx.effect.value > 0 ? ctx.effect.value : 1));
        if (amount > 0) ctx.engine.applyDamage(ctx.target, amount, ctx.caster);
    });

    registry.register('meltToxin', (ctx) => {
        const eff = ctx.effect;
        const required = eff.threshold > 0 ? eff.threshold : 6;
        if (ctx.target.virus < required) return;
        ctx.target.virus -= required;
        if (eff.value > 0) {
            let damage = eff.value;
            if (!ctx.strengthApplied) {
                damage += ctx.caster.strength - ctx.caster.weakness;
                ctx.strengthApplied = true;
            }
            ctx.engine.applyDamage(ctx.target, Math.max(1, roundToInt(damage)), ctx.caster);
        }
        execute(eff.effects, ctx);
        // NewWorld's meltToxin does not emit NotifyVirusConsumed.
    });

    registry.register('cleanseAndReflectDebuffs', (ctx) => {
        const { caster, target, engine } = ctx;
        const weakness = Math.max(0, caster.weakness);
        const virus = Math.max(0, caster.virus);
        const corrosion = Math.max(0, caster.corrosion);
        if (weakness <= 0 && virus <= 0 && corrosion <= 0) return;
        caster.weakness = caster.virus = caster.corrosion = 0;
        target.weakness += weakness;
        target.virus += virus;
        target.corrosion += corrosion;
        if (virus > 0) engine.notifyVirusApplied(caster, target, virus);
    });

    const executeGambleBranch = (ctx, eff, success) => {
        execute(success ? eff.thenEffects : ctx.caster.turn.lastGambleUnluckSoftened ? null : eff.elseEffects, ctx);
    };

    registry.register('gamble', (ctx) => {
        const eff = ctx.effect;
        executeGambleBranch(ctx, eff, resolveGamble(ctx, eff.chance > 0 ? eff.chance : 0.5));
    });

    registry.register('russianRoulette', (ctx) => {
        const eff = ctx.effect;
        const hits = eff.hits > 0 ? eff.hits : 1;
        const rounds = hits > 1 ? hits : 6;
        for (let i = 0; i < rounds; i++) {
            const success = resolveGamble(ctx, eff.chance > 0 ? eff.chance : 0.5);
            executeGambleBranch(ctx, eff, success);
            if (!success) break;
        }
    });

    registry.register('diceRoll', (ctx) => {
        const { caster, effect: eff } = ctx;
        let roll = Math.floor(Math.random() * 6) + 1;
        if (eff.mode === 'luck' && caster.luck > 0) roll = Math.min(6, Math.max(1, roll + Math.min(caster.luck, 3)));
        ctx.engine.notifyDiceResult?.(caster, roll, ctx.card);
        if (eff.effects?.length) {
            ctx.effect = eff.effects[Math.min(roll - 1, eff.effects.length - 1)];
            try {
                registry.execute(ctx.effect.type, ctx);
            } finally {
                ctx.effect = eff;
            }
        } else {
            const high = roll >= 4;
            if (high) registerGambleSuccess(caster);
            else if (!caster.ignoreUnluck) {
                caster.turn.unluckyThisTurn = (caster.turn.unluckyThisTurn || 0) + 1;
                caster.unluckyThisBattle = (caster.unluckyThisBattle || 0) + 1;
                if (caster.turn.buffInsuranceValue > 0) caster.shield += caster.turn.buffInsuranceValue;
                if (caster.turn.buffInsuranceLuckValue > 0) caster.luck += caster.turn.buffInsuranceLuckValue;
            }
            execute(high ? eff.thenEffects : eff.elseEffects, ctx);
        }
    });

    registry.register('fullHouseHit', (ctx) => {
        const eff = ctx.effect;
        const hits = eff.hits > 0 ? eff.hits : 1;
        for (let i = 0; i < hits; i++) {
            executeGambleBranch(ctx, eff, resolveGamble(ctx, eff.chance > 0 ? eff.chance : 0.5));
        }
    });

    const insurance = (ctx) => {
        ctx.caster.turn.buffInsuranceValue = (ctx.caster.turn.buffInsuranceValue || 0) + roundToInt(ctx.effect.value || 0);
        ctx.caster.turn.buffInsuranceLuckValue = (ctx.caster.turn.buffInsuranceLuckValue || 0) + roundToInt(ctx.effect.bonusMultiplier || 0);
    };
    registry.register('buffInsurance', insurance);
    registry.register('buffInsuranceLuck', insurance);
    registry.register('gambleChanceBuff', (ctx) => {
        ctx.caster.turn.gambleBonusChance = (ctx.caster.turn.gambleBonusChance || 0) + roundToInt(ctx.effect.value || 0);
    });
    registry.register('retryOnUnluck', (ctx) => { ctx.caster.turn.retryOnUnluckFlag = true; });
    registry.register('coinFlipHeads', (ctx) => {
        const eff = ctx.effect;
        const heads = resolveGamble(ctx, 0.5);
        if (heads) {
            const lostHp = ctx.caster.maxHp - ctx.caster.hp;
            if (lostHp > 0) ctx.caster.shield += lostHp;
        }
        executeGambleBranch(ctx, eff, heads);
    });
}
