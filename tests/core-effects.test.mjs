import assert from 'node:assert/strict';
import { applyCoreEffects, notifyVirusConsumed } from '../js/core-effects.js';
import { resolveGamble } from '../js/effects-bio-gamble.js';
import { fixture, card, play, context, withRandom } from './helpers.mjs';

function execute(engine, caster, target, effect) {
    engine.executeEffects([effect], context(engine, caster, target, effect));
}

export const tests = [
    ['virus consumption requires its full fixed threshold before granting rewards', () => {
        const { engine, caster, target } = fixture();
        caster.hp = 30;
        target.virus = 1;
        execute(engine, caster, target, { type: 'consumeVirus', threshold: 6, action: 'heal', ratio: 2 });
        assert.equal(target.virus, 1);
        assert.equal(caster.hp, 30);
        assert.equal(caster.turn.virusConsumedThisTurn, 0);
    }],
    ['consume-all damage uses shields and does not inherit attack strength', () => {
        const { engine, caster, target } = fixture();
        caster.strength = 20;
        target.virus = 6;
        target.shield = 4;
        execute(engine, caster, target, { type: 'consumeVirus', countAll: true, ratio: 1 });
        assert.equal(target.virus, 0);
        assert.equal(target.hp, 78);
        assert.equal(target.shield, 0);
        assert.equal(caster.turn.virusConsumedThisTurn, 6);
    }],
    ['BIO_027 gives shield per consumed stack and healing per complete chunk', () => {
        const { engine, state, caster, target } = fixture();
        caster.hp = 30;
        target.virus = 12;
        play(engine, state, caster, 'BIO_027');
        assert.equal(caster.shield, 60);
        assert.equal(caster.hp, 38);
        assert.equal(target.virus, 0);
    }],
    ['double-first-skill repeats exactly the first skill of each turn', () => {
        const { engine, state, caster } = fixture();
        caster.energy = 10;
        caster.activeCores.push(card('BASE_040'));
        play(engine, state, caster, { id: 'SKILL1', type: 'skill', cost: 0, keywords: [], effects: [{ type: 'shield', value: 3 }] });
        play(engine, state, caster, { id: 'SKILL2', type: 'skill', cost: 0, keywords: [], effects: [{ type: 'shield', value: 3 }] });
        assert.equal(caster.shield, 9);
    }],
    ['turn-start exoskeleton grants canonical shield and luck-to-strength core runs only at turn start', () => {
        const { engine, caster } = fixture();
        caster.activeCores.push(card('BASE_033'), card('RU_029'));
        caster.luck = 5;
        applyCoreEffects(engine, 'turnStart', caster);
        assert.equal(caster.shield, 18);
        assert.equal(caster.strength, 5);
        caster.luck += 3;
        assert.equal(caster.strength, 5);
    }],
    ['BIO_040 applies 12 virus and 2 corrosion and virus-consume strength uses bank rounding', () => {
        const { engine, caster, target } = fixture();
        caster.activeCores.push(card('BIO_040'));
        applyCoreEffects(engine, 'turnStart', caster);
        assert.equal(target.virus, 12);
        assert.equal(target.corrosion, 2);
        caster.activeCores = [card('BIO_039')];
        notifyVirusConsumed(engine, caster, 6);
        assert.equal(caster.strength, 4);
    }],
    ['virus farm uses canonical 30 percent and rounds five stacks to two damage', () => {
        const { engine, caster, target } = fixture();
        caster.activeCores.push(card('BIO_038'));
        target.virus = 5;
        applyCoreEffects(engine, 'turnStart', caster);
        assert.equal(target.hp, 78);
    }],
    ['insurance grants both shield and luck on final failure and consumes the next-roll bonus', () => {
        const { engine, state, caster, target } = fixture();
        play(engine, state, caster, 'RU_015');
        caster.turn.gambleBonusChance = 5;
        withRandom([0.99], () => assert.equal(resolveGamble(context(engine, caster, target, null), 0.5), false));
        assert.equal(caster.shield, 10);
        assert.equal(caster.luck, 1);
        assert.equal(caster.turn.unluckyThisTurn, 1);
        assert.equal(caster.turn.gambleBonusChance, 0);
    }],
    ['retry success records one luck and no unluck or failure effects', () => {
        const { engine, caster, target } = fixture();
        caster.turn.retryOnUnluckFlag = true;
        withRandom([0.99, 0], () => assert.equal(resolveGamble(context(engine, caster, target, null), 0.5), true));
        assert.equal(caster.turn.retryOnUnluckFlag, false);
        assert.equal(caster.turn.luckyThisTurn, 1);
        assert.equal(caster.turn.unluckyThisTurn, 0);
        assert.equal(caster.luckyThisBattle, 1);
    }],
    ['every successful full-house roll updates luck counters and roulette core', () => {
        const { engine, caster, target } = fixture({ hp: 1000 });
        caster.activeCores.push(card('RU_040'));
        withRandom([0], () => execute(engine, caster, target, { type: 'fullHouseHit', hits: 5, chance: 0.5, value: 1 }));
        assert.equal(caster.turn.luckyThisTurn, 5);
        assert.equal(caster.luckyThisBattle, 5);
        assert.equal(caster.luck, 15);
    }],
    ['random-buff turn-start core does not grant buffs on a failed 50-percent roll', () => {
        const { engine, caster } = fixture();
        caster.activeCores.push(card('RU_038'));
        withRandom([0.99], () => applyCoreEffects(engine, 'turnStart', caster));
        assert.equal(caster.strength, 0);
        assert.equal(caster.energy, 3);
        assert.equal(caster.hand.length, 0);
        assert.equal(caster.turn.unluckyThisTurn, 1);
    }],
    ['bankruptcy failed reroll takes current-HP percent directly without consuming shield', () => {
        const { engine, caster, target } = fixture({ hp: 100 });
        caster.shield = 30;
        caster.activeCores.push(card('RU_039'));
        withRandom([0.99], () => assert.equal(resolveGamble(context(engine, caster, target, null), 0.5), false));
        assert.equal(caster.hp, 85);
        assert.equal(caster.shield, 30);
        assert.equal(caster.turn.unluckyThisTurn, 1);
    }]
];
