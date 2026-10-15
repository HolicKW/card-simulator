import assert from 'node:assert/strict';
import { CardAI } from '../js/ai.js';
import { Simulator } from '../js/simulator.js';
import { getAllCards } from '../js/cards.js';
import { withSeed, probeCard, measureCard, benchmarkDecks, pairedTrial, summarizeTrials, calibrateTiers, rankTiers, PerformanceEvaluator } from '../js/performance.js';
import { performanceReportHTML } from '../js/performance-view.js';
import { card } from './helpers.mjs';

const ordinary = { cardId: 'DM_007', cardName: '임시 땜빵', pack: 'dismantle', rarity: 'common' };
const record = (winner, logs = [ordinary], side) => ({ side, enemy: 'T1 미러',
    deck: [card('DM_007'), card('BASE_001')], result: { winner, cardUsageLog: logs } });
// 빈 슬롯 대비 승점 변화가 시드마다 values를 순환하는 일반 덱 측정 결과
const gain = (...values) => ({ general: summarizeTrials(Array.from({ length: 200 }, (_, index) => ({ seed: index,
    candidate: values[index % values.length], reference: 0, empty: 0, played: 1, uses: 1, draws: 0, selfDefeats: 0 }))) });
const tierOne = getAllCards().filter(next => next.tier === 1).map(next => next.id);

export const tests = [
    ['seed scopes reproduce effects and restore global randomness even after an exception', () => {
        const original = Math.random;
        assert.deepEqual(withSeed(31, () => [Math.random(), Math.random()]), withSeed(31, () => [Math.random(), Math.random()]));
        assert.throws(() => withSeed(2, () => { throw Error('stop'); }), /stop/);
        assert.equal(Math.random, original);
    }],
    ['T1 attack and defense anchors are separate units and follow-ups do not inflate original uses', () => {
        const attack = probeCard('BASE_001'), defense = probeCard('BASE_005');
        assert.equal(attack.attackUnits, 1); assert.equal(attack.defenseUnits, 0);
        assert.equal(defense.attackUnits, 0); assert.equal(defense.defenseUnits, 1);
        assert.equal(attack.uses, 1); assert.equal(defense.uses, 1);
    }],
    ['native strength, healing caps, conditional costs and gating are measured rather than inferred', () => {
        assert.equal(probeCard('BASE_002', { scenario: 'prepared' }).immediate.damageShield, 16);
        assert.equal(probeCard('BASE_007').immediate.healing, 0);
        assert.equal(probeCard('BASE_007', { scenario: 'prepared' }).immediate.healing, 10);
        assert.equal(probeCard('BASE_027').effectiveCost, 3);
        assert.equal(probeCard('BASE_027', { scenario: 'prepared' }).effectiveCost, 1);
        assert.equal(probeCard('BIO_026').playable, false);
        assert.equal(probeCard('BIO_026', { scenario: 'prepared' }).immediate.healing, 30);
        assert.equal(probeCard('NW_011', { scenario: 'prepared' }).immediate.damageShield, 24);
    }],
    ['rebuild and core diagnostics subtract the scripted follow-up control', () => {
        const rebuild = measureCard('DM_007', 2).basic;
        assert.equal(rebuild.uses, 3);
        assert.equal(rebuild.checkpoints[0].metrics.shield, 18);
        assert.equal(rebuild.checkpoints[0].metrics.paidEnergy, 3);
        const core = measureCard('BASE_033', 2).basic;
        assert.equal(core.checkpoints[0].metrics.shield, 54);
        assert.equal(core.checkpoints[1].metrics.shield, 90);
    }],
    ['every ordinary card has legal fixed-size benchmark decks and finite basic measurements', () => {
        for (const source of getAllCards()) {
            for (const context of ['general', 'dedicated']) {
                const decks = benchmarkDecks(source.id, context);
                assert.equal(decks.candidate.length, 20, source.id);
                assert.equal(decks.reference.length, 20, source.id);
                assert.equal(decks.empty.length, 20, source.id);
                assert.equal(decks.opponent.length, 20, source.id);
                assert.deepEqual(decks.candidate.slice(1), decks.reference.slice(1));
                assert.equal(decks.candidate.filter(next => next.id === source.id).length, 1);
            }
            const measured = probeCard(source.id, { followTurns: 0 });
            assert.ok(Object.values(measured.immediate).filter(value => typeof value === 'number').every(Number.isFinite), source.id);
        }
    }],
    ['identical slot substitutions have exactly zero effect under both first sides and a reproducible policy', () => {
        const first = pairedTrial('BASE_001', 'general', 17);
        assert.deepEqual(first, pairedTrial('BASE_001', 'general', 17));
        assert.equal(first.candidate, first.reference);
        const summary = summarizeTrials([first, pairedTrial('BASE_001', 'general', 18)]);
        assert.equal(summary.delta.mean, 0);
        assert.equal(summary.matches, 12); assert.equal(summary.seeds, 2);
        assert.equal(summary.calibrated, false);
    }],
    ['sample size, not the reference card, decides whether a measurement counts', () => {
        const flat = { seed: 1, candidate: 1, reference: 0.5, empty: 0.5, played: 1, uses: 1, draws: 0, selfDefeats: 0 };
        assert.equal(summarizeTrials(Array.from({ length: 199 }, () => flat)).calibrated, false);
        // 기준 카드(신속 타격)가 전혀 기여하지 않아도 카드 자체의 승점 변화는 확정된다
        const enough = summarizeTrials(Array.from({ length: 200 }, () => flat));
        assert.equal(enough.calibrated, true); assert.equal(enough.benefit.mean, 0.5);
        const harmful = summarizeTrials(Array.from({ length: 200 }, () => ({ ...flat, candidate: 0 })));
        assert.equal(harmful.benefit.mean, -0.5); assert.equal(harmful.calibrated, true);
    }],
    ['tier targets are the median gain of at least three measured cards in the same tier', () => {
        assert.deepEqual(calibrateTiers({ BASE_001: gain(0.2), BASE_002: gain(0.4), BASE_005: gain(0.1), BASE_018: gain(0.3) }), { 1: 0.2 });
        assert.deepEqual(calibrateTiers({ BASE_001: gain(-0.1), BASE_002: gain(0), BASE_005: gain(0) }), {});
        const few = { BASE_001: { general: summarizeTrials([gain(0.2).general.trials[0]]) }, BASE_002: gain(0.4), BASE_005: gain(0.1) };
        assert.deepEqual(calibrateTiers(few), {});
    }],
    ['measured cards are graded by rank within their tier and clearly harmful cards are F', () => {
        // 승점 +20%p ~ +1%p 20장, 빈 칸보다 확실히 나쁜 카드(-5%p) 1장
        const ids = tierOne.slice(0, 21);
        const ranks = rankTiers(Object.fromEntries(ids.map((id, index) => [id, index < 20 ? gain((20 - index) / 100) : gain(-0.05)])));
        assert.equal(ids.map(id => ranks[id].grade).join(''), 'SSAAAABBBBBBBBCCCCDDF');
        assert.deepEqual(ids.filter(id => ranks[id].op), [ids[0]]);
        assert.deepEqual(ids.filter(id => ranks[id].up), [ids[20]]);
        assert.equal(ranks[ids[0]].top, 0.0476); assert.deepEqual(ranks[ids[0]].topRange, [0.0476, 0.0476]);
        // 표본이 흔들리는 카드는 순위 범위가 넓게 나온다
        const noisy = rankTiers({ ...Object.fromEntries(ids.slice(0, 20).map((id, index) => [id, gain((20 - index) / 100)])), [ids[20]]: gain(-0.3, 0.5) });
        const [best, worst] = noisy[ids[20]].topRange;
        assert.ok(best < noisy[ids[20]].top && noisy[ids[20]].top < worst);
        assert.deepEqual(rankTiers(Object.fromEntries(ids.slice(0, 9).map(id => [id, gain(0.1)]))), {});
    }],
    ['learning gives provisional grades and ranked measurements override them', () => {
        const sim = new Simulator();
        sim.ai.endGeneration([record('player', [ordinary], 'A')]);
        sim.ai.cardWeights.set('DM_007', 0.5);
        const graded = () => sim.getAnalysis().tierList.find(next => next.id === 'DM_007');
        assert.equal(graded().valueTier, 'D'); assert.equal(graded().gradeSource, 'provisional');
        assert.equal(sim.getAnalysis().tierList.find(next => next.id === 'BASE_040').valueTier, '?');
        const others = tierOne.filter(id => id !== 'DM_007').slice(0, 20);
        sim.performanceReport = { tierTargets: {}, cards: { ...Object.fromEntries(others.map((id, index) => [id, gain((index + 1) / 100)])), DM_007: gain(0.5) } };
        assert.equal(graded().valueTier, 'S'); assert.equal(graded().gradeSource, 'measured');
        assert.deepEqual(sim.getAnalysis().warnings.map(warning => warning.type + ' ' + warning.card.id), ['OP DM_007']);
        // 같은 티어 측정 카드가 10장 미만이면 순위를 매기지 않고 잠정 등급을 유지한다
        sim.performanceReport = { tierTargets: {}, cards: { DM_007: gain(0.5) } };
        assert.equal(graded().valueTier, 'D'); assert.equal(graded().gradeSource, 'provisional');
        assert.equal(sim.getAnalysis().warnings.length, 0);
    }],
    ['measurement table shows each confirmed card rank within its tier', () => {
        const probes = measureCard('BASE_002', 1), ids = tierOne.slice(0, 10);
        const report = { status: 'complete', config: { cardIds: ids, deckSize: 20, seed: 1 }, tierTargets: { 1: 0.05 },
            cards: Object.fromEntries(ids.map((id, index) => [id, { probes, ...gain((10 - index) / 100), dedicated: gain(0.01).general }])) };
        const html = performanceReportHTML(report);
        assert.match(html, /상위 10%/);   // 10장 중 1위
        assert.doesNotMatch(html, /NaN|undefined|Infinity|미확정/);
    }],
    ['one battle credits a rebuild card once while retaining all plays and unused deck inclusions', () => {
        const once = new CardAI(), repeated = new CardAI();
        once.updateWeights({ cardUsageLog: [ordinary] }, 'win');
        repeated.updateWeights({ cardUsageLog: Array(10).fill(ordinary) }, 'win');
        assert.equal(once.cardWeights.get('DM_007'), repeated.cardWeights.get('DM_007'));
        repeated.endGeneration([record('player', Array(10).fill(ordinary), 'A'), record('enemy', [], 'B')]);
        const stats = repeated.cumulativeStats.get('DM_007');
        assert.equal(stats.wins, 1); assert.equal(stats.losses, 1); assert.equal(stats.uses, 10);
        assert.equal(stats.playedGames, 1); assert.equal(stats.deckInclusions, 2);
        assert.equal(repeated.cumulativeStats.get('BASE_001').deckInclusions, 2);
        assert.equal(repeated.history[0].totalGames, 1);
        assert.equal(repeated.getCardTierList().find(next => next.id === 'DM_007').playRate, 50);
        assert.equal(repeated.getCardTierList().find(next => next.id === 'DM_007').valueTier, '?');
    }],
    ['draws count once per card and never become losses or modify selection weights', () => {
        const ai = new CardAI(), before = [...ai.cardWeights];
        ai.updateWeights({ cardUsageLog: [ordinary] }, 'draw');
        ai.endGeneration([record('draw', [ordinary], 'A'), record('draw', [ordinary], 'B')]);
        assert.deepEqual([...ai.cardWeights], before);
        assert.equal(ai.cumulativeStats.get('DM_007').losses, 0);
        assert.equal(ai.cumulativeStats.get('DM_007').draws, 2);
        assert.equal(ai.history[0].totalGames, 1); assert.equal(ai.history[0].draws, 1);
    }],
    ['evaluation leaves learning frozen and supports round-trip imports and partial cancellation', async () => {
        const sim = new Simulator(), before = sim.ai.exportWeights();
        const report = await sim.runPerformance({ cardIds: ['BASE_001'], seeds: 2, probeSamples: 2 });
        assert.deepEqual(sim.ai.exportWeights(), before);
        assert.equal(report.status, 'complete');
        assert.equal(report.cards.BASE_001.general.delta.mean, 0);
        const exported = sim.exportData(), restored = new Simulator();
        restored.importData(exported);
        assert.deepEqual(restored.exportData(), exported);
        const html = performanceReportHTML(report);
        assert.match(html, /미확정/); assert.doesNotMatch(html, /NaN|undefined|Infinity/);
        const evaluator = new PerformanceEvaluator();
        const partial = await evaluator.run({ cardIds: ['BASE_001', 'BASE_005'], seeds: 5, probeSamples: 1 }, () => evaluator.stop());
        assert.equal(partial.status, 'cancelled'); assert.equal(evaluator.running, false);
        restored.importData({ kind: 'performance-report', schemaVersion: 1, performance: partial });
        assert.deepEqual(restored.ai.exportWeights(), before);
        const forged = JSON.parse(JSON.stringify(report));
        forged.cards.BASE_001.general.index = 999;
        forged.cards.BASE_001.general.calibrated = true;
        restored.importData({ kind: 'performance-report', schemaVersion: 1, performance: forged });
        assert.equal(restored.performanceReport.cards.BASE_001.general.calibrated, false);
        const prior = restored.exportData();
        forged.cards.BASE_001.general.trials[0].candidate = NaN;
        assert.throws(() => restored.importData({ kind: 'performance-report', schemaVersion: 1, performance: forged }), /表本|표본/);
        assert.deepEqual(restored.exportData(), prior);
    }],
    ['old and malformed imports fail atomically and evaluation rejects invalid settings', async () => {
        const sim = new Simulator(), before = sim.exportData();
        assert.throws(() => sim.importData({ ...before, schemaVersion: 2 }), /NewWorld/);
        assert.throws(() => sim.importData({ ...before, weights: { ...before.weights, BASE_001: NaN } }), /NewWorld/);
        assert.deepEqual(sim.exportData(), before);
        await assert.rejects(sim.runPerformance({ seeds: 1 }), /시드/);
        await assert.rejects(sim.runPerformance({ cardIds: ['STATUS_STRUGGLE'], seeds: 2 }), /일반 카드/);
    }]
];
