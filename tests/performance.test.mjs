import assert from 'node:assert/strict';
import { CardAI } from '../js/ai.js';
import { Simulator } from '../js/simulator.js';
import { getAllCards } from '../js/cards.js';
import { withSeed, probeCard, measureCard, benchmarkDecks, pairedTrial, summarizeTrials, PerformanceEvaluator } from '../js/performance.js';
import { performanceReportHTML } from '../js/performance-view.js';
import { card } from './helpers.mjs';

const ordinary = { cardId: 'DM_007', cardName: '임시 땜빵', pack: 'dismantle', rarity: 'common' };
const record = (winner, logs = [ordinary], side) => ({ side, enemy: 'T1 미러',
    deck: [card('DM_007'), card('BASE_001')], result: { winner, cardUsageLog: logs } });

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
    ['noisy or zero reference contribution cannot produce a confirmed performance multiplier', () => {
        const flat = { seed: 1, candidate: 1, reference: 0.5, empty: 0.5, played: 1, uses: 1, draws: 0, selfDefeats: 0 };
        assert.equal(summarizeTrials(Array.from({ length: 200 }, () => flat)).index, null);
        const confirmed = summarizeTrials(Array.from({ length: 200 }, () => ({ ...flat, reference: 1, empty: 0 })));
        assert.equal(confirmed.index, 1); assert.equal(confirmed.calibrated, true);
    }],
    ['negative contributions are retained and uncertain grade boundaries stay unrated', () => {
        const trial = { seed: 1, candidate: 0, reference: 1, empty: 0.5, played: 1, uses: 1, draws: 0, selfDefeats: 0 };
        const harmful = summarizeTrials(Array.from({ length: 200 }, () => trial));
        assert.equal(harmful.index, -1); assert.equal(harmful.calibrated, true);
        const sim = new Simulator();
        const uncertain = summarizeTrials(Array.from({ length: 200 }, (_, index) => ({ ...trial,
            candidate: index % 2 ? 1 : 0.5, reference: 0.5, empty: 0 })));
        sim.performanceReport = { tierTargets: { 1: 1 }, cards: { BASE_001: { general: uncertain } } };
        assert.equal(sim.getAnalysis().tierList.find(card => card.id === 'BASE_001').valueTier, '?');
        assert.equal(sim.getAnalysis().warnings.length, 0);
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
