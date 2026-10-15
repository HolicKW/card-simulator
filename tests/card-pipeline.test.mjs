import assert from 'node:assert/strict';
import { fixture, card, play, context } from './helpers.mjs';

export const tests = [
    ['NW_017 successful protocol replaces the base shield instead of adding both', () => {
        const { engine, state, caster } = fixture({ hp: 100 });
        caster.lastPlayedCard = card('BASE_014');
        play(engine, state, caster, 'NW_017');
        assert.equal(caster.shield, 30);
    }],
    ['playing another card adds one accumulation and the triggered card resets its own count', () => {
        const { engine, state, caster, target } = fixture();
        const accumulator = card('BIO_035');
        accumulator.accumulationCount = 5;
        caster.hand.push(accumulator);
        play(engine, state, caster, 'BASE_001');
        assert.equal(accumulator.accumulationCount, 6);
        assert.equal(engine._mirrorPlayCard(state, 'A', 0, []), true);
        assert.equal(accumulator.accumulationCount, 0);
        assert.equal(target.virus, 16);
        assert.equal(caster.hand.length, 2);
        assert.equal(caster.energy, 2);
    }],
    ['BASE_023 counts only non-base cards remaining in hand when granting shield', () => {
        const { engine, state, caster } = fixture();
        caster.hand.push(card('OC_001'), card('NW_001'), card('BASE_001'));
        play(engine, state, caster, 'BASE_023');
        assert.equal(caster.shield, 8);
        assert.equal(caster.hand.length, 4);
    }],
    ['chosen dismantle removes the explicitly selected instance and dispatches extraction', () => {
        const { engine, caster, target } = fixture();
        const selected = {
            id: 'TEST_CHOSEN', name: 'Selected', type: 'skill', cost: 2, keywords: [],
            effects: [], extractEffects: [{ type: 'shield', value: 5 }]
        };
        const retained = card('BASE_001');
        caster.hand.push(retained, selected);
        engine.pendingDismantleTargets.push(selected);
        const effect = { type: 'dismantle', mode: 'chosen', value: 1 };
        engine.executeEffects([effect], context(engine, caster, target, effect));
        assert.deepEqual(caster.hand, [retained]);
        assert.equal(caster.voidPile[0], selected);
        assert.equal(caster.turn.dismantledThisTurn, 1);
        assert.equal(caster.dismantledThisBattle, 1);
        assert.equal(caster.shield, 5);
        assert.equal(engine.pendingDismantleTargets.length, 0);
    }],
    ['querying legal cards never pre-draws or mutates chosen-dismantle selection state', () => {
        const { engine, caster } = fixture();
        caster.hand.push(card('DM_008'), card('DM_024'), card('BASE_001'));
        const snapshot = () => JSON.stringify({
            hand: caster.hand, drawPile: caster.drawPile, energy: caster.energy,
            queue: engine.pendingDismantleTargets, skipDraw: caster.skipNextDrawCount
        });
        const before = snapshot();
        assert.deepEqual(caster.hand.map((_card, index) => engine.canPlayCard(caster, index)), [true, true, true]);
        assert.equal(snapshot(), before);
    }],
    ['automatic chosen-dismantle cards pre-draw exactly once then execute their selected removals', () => {
        for (const [id, drawn, dismantled, expectedHp] of [
            ['DM_008', 2, 1, 80], ['DM_024', 3, 2, 72]
        ]) {
            const { engine, state, caster } = fixture();
            const before = caster.drawPile.length;
            assert.equal(play(engine, state, caster, id), true);
            assert.equal(caster.drawPile.length, before - drawn, id);
            assert.equal(caster.turn.dismantledThisTurn, dismantled, id);
            assert.equal(caster.hand.length, 1, id);
            assert.equal(caster.hp, expectedHp, id);
            assert.equal(caster.skipNextDrawCount, 0, id);
            assert.equal(engine.pendingDismantleTargets.length, 0, id);
        }
    }]
];
