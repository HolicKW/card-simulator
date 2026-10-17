import assert from 'node:assert/strict';
import { getAllCards, getCardById, listEditableFields, applyCardOverrides, getCardOverrides, overridesKey } from '../js/cards.js';
import { probeCard, summarizeTrials, PerformanceEvaluator } from '../js/performance.js';
import { nodeWorkerEvaluator } from '../scripts/worker-pool.mjs';
import { CardAI } from '../js/ai.js';
import { Simulator } from '../js/simulator.js';

// 수정 상태는 모듈 전역이므로 테스트마다 반드시 원래대로 되돌린다
const withOverrides = async (overrides, action) => {
    applyCardOverrides(overrides);
    try { return await action(); } finally { applyCardOverrides({}); }
};
const damageOf = id => { const hit = probeCard(id).immediate; return hit.damageHp + hit.damageShield; };
const gain = value => ({ general: summarizeTrials(Array.from({ length: 200 }, (_, seed) => ({ seed,
    candidate: value, empty: 0, played: 1, uses: 1, draws: 0, selfDefeats: 0 }))) });

export const tests = [
    ['editable fields cover cost and every effect or core number with readable labels', () => {
        const fields = listEditableFields('BASE_003');
        assert.deepEqual(fields.map(field => [field.path, field.original]), [['cost', 1], ['effects.0.value', 4], ['effects.1.value', 1]]);
        assert.match(fields[1].label, /피해/); assert.match(fields[2].label, /약화/);
        assert.ok(listEditableFields('BASE_033').some(field => field.path === 'coreEffect.shield' && field.original === 18));
        assert.deepEqual(listEditableFields('NOPE'), []);
    }],
    ['overrides change the live card used in battle and reset restores the original', async () => {
        assert.equal(damageOf('BASE_003'), 4);
        await withOverrides({ BASE_003: { 'effects.0.value': 9, cost: 0 } }, () => {
            assert.equal(getCardById('BASE_003').effects[0].value, 9);
            assert.equal(getCardById('BASE_003').cost, 0);
            assert.equal(damageOf('BASE_003'), 9);
            assert.deepEqual(getCardOverrides(), { BASE_003: { cost: 0, 'effects.0.value': 9 } });
        });
        assert.equal(getCardById('BASE_003').effects[0].value, 4);
        assert.deepEqual(getCardOverrides(), {});
    }],
    ['invalid overrides are rejected as a whole and values equal to the original are dropped', () => {
        const bad = [{ NOPE: { cost: 1 } }, { BASE_003: { 'effects.9.value': 1 } }, { BASE_003: { cost: 1.5 } },
            { BASE_003: { 'effects.0.value': Infinity } }, { BASE_003: { 'effects.0.value': '7' } }, { BASE_003: { name: 1 } }];
        for (const overrides of bad) assert.throws(() => applyCardOverrides({ ...overrides, BASE_001: { 'effects.0.value': 7 } }), /카드 수정/);
        assert.equal(getCardById('BASE_001').effects[0].value, 6);   // 거부되면 아무것도 바뀌지 않는다
        applyCardOverrides({ BASE_003: { 'effects.0.value': 4 } });
        assert.deepEqual(getCardOverrides(), {});
        assert.equal(overridesKey({ B: { y: 1, x: 2 }, A: { z: 3 } }), overridesKey({ A: { z: 3 }, B: { x: 2, y: 1 } }));
    }],
    ['measurements record overrides and workers measure the modified card', async () => {
        const config = { cardIds: ['BASE_003'], seeds: 3, probeSamples: 1 };
        const original = await new PerformanceEvaluator().run(config);
        assert.deepEqual(original.config.overrides, {});
        await withOverrides({ BASE_003: { 'effects.0.value': 30 } }, async () => {
            const sequential = await new PerformanceEvaluator().run(config);
            const parallel = await nodeWorkerEvaluator(2).run({ ...config, cardIds: ['BASE_003', 'BASE_001'] });
            assert.deepEqual(sequential.config.overrides, { BASE_003: { 'effects.0.value': 30 } });
            assert.deepEqual(parallel.cards.BASE_003, sequential.cards.BASE_003);
            assert.notDeepEqual(sequential.cards.BASE_003.probes, original.cards.BASE_003.probes);
        });
    }],
    ['learning files and measurements made under other card values are kept apart', async () => {
        const sim = new Simulator();
        const baseline = await sim.runPerformance({ cardIds: ['BASE_003'], seeds: 2, probeSamples: 1 });
        const exported = sim.exportData();
        await withOverrides({ BASE_003: { 'effects.0.value': 30 } }, async () => {
            assert.throws(() => new CardAI().importWeights(exported), /카드 수치/);
            assert.equal(sim.activeReport(), null);   // 수정 전 측정은 지금 등급에 쓰지 않는다
            const edited = await sim.runPerformance({ cardIds: ['BASE_003'], seeds: 2, probeSamples: 1 });
            assert.equal(sim.activeReport(), edited);
            assert.equal(sim.baselineReport, baseline);
        });
        assert.equal(sim.activeReport(), baseline);   // 원래대로 돌리면 원본 측정이 다시 쓰인다
    }],
    ['ranked results show the grade before the edit next to the new one', async () => {
        const ids = getAllCards().filter(card => card.tier === 1).slice(0, 12).map(card => card.id);
        const sim = new Simulator(), edits = { [ids[11]]: { cost: 0 } };
        sim.baselineReport = { config: { overrides: {} }, tierTargets: {},
            cards: Object.fromEntries(ids.map((id, index) => [id, gain((12 - index) / 100)])) };
        await withOverrides(edits, () => {
            sim.performanceReport = { config: { overrides: edits }, tierTargets: {},
                cards: { ...sim.baselineReport.cards, [ids[11]]: gain(0.5) } };
            const analysis = sim.getAnalysis(), card = analysis.tierList.find(next => next.id === ids[11]);
            assert.equal(card.valueTier, 'S'); assert.equal(card.before.grade, 'D');
            assert.deepEqual(analysis.comparison.map(row => [row.id, row.before.grade, row.after.grade]), [[ids[11], 'D', 'S']]);
        });
    }],
];
