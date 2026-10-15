import assert from 'node:assert/strict';
import { CardAI } from '../js/ai.js';
import { fixture, card } from './helpers.mjs';

export const tests = [
    ['AI uses engine dynamic and scaled costs instead of rejecting their printed costs', () => {
        const { engine, caster, target } = fixture();
        const ai = new CardAI();
        caster.hand = [card('OC_033')];
        caster.overclockStacks = 7;
        caster.energy = 1;
        assert.equal(engine.getEffectiveCost(caster.hand[0], caster), 1);
        assert.deepEqual(ai.makeDecision({ player: caster, enemy: target, turn: 1 }, engine), { action: 'play_card', cardIndex: 0 });
        caster.hand = [card('BASE_027')];
        target.hp = 40;
        assert.deepEqual(ai.makeDecision({ player: caster, enemy: target, turn: 1 }, engine), { action: 'play_card', cardIndex: 0 });
        caster.hand = [card('RU_031')];
        caster.luck = 10;
        caster.energy = 0;
        assert.deepEqual(ai.makeDecision({ player: caster, enemy: target, turn: 1 }, engine), { action: 'play_card', cardIndex: 0 });
    }],
    ['AI obeys native virus, overclock and forced-end gating', () => {
        const { engine, caster, target } = fixture();
        const ai = new CardAI();
        caster.energy = 10;
        const source = { id: 'TEST_GATE', type: 'attack', cost: 0, keywords: [], effects: [] };
        for (const gate of [{ requiresOverclock: true }, { overclockThreshold: 4 }, { overflowMin: 3 }, { virusThreshold: 6 }]) {
            caster.hand = [{ ...source, ...gate }];
            assert.deepEqual(ai.makeDecision({ player: caster, enemy: target, turn: 1 }, engine), { action: 'end_turn' });
        }
        caster.hand = [card('BASE_001')];
        caster.forceEndTurn = true;
        assert.deepEqual(ai.makeDecision({ player: caster, enemy: target, turn: 1 }, engine), { action: 'end_turn' });
    }],
    ['IP cards are available to deck building and special status cards stay outside regular decks', () => {
        const ai = new CardAI();
        for (const id of ai.cardWeights.keys()) {
            if (!id.startsWith('IP_')) ai.cumulativeStats.set(id, { uses: 10 });
        }
        const deck = ai.buildDeck(['base', 'IP'], 5, 40);
        assert.ok(deck.some(card => card.pack === 'IP'));
        assert.ok(deck.every(card => !card.id.startsWith('STATUS_')));
    }],
    ['old-rule learning files are rejected before changing the current AI', () => {
        const ai = new CardAI();
        const before = ai.exportWeights();
        assert.throws(() => ai.importWeights({ generation: 99, weights: { BASE_001: 1000 } }), /NewWorld/);
        assert.deepEqual(ai.exportWeights(), before);
        const restored = new CardAI();
        restored.importWeights(before);
        assert.deepEqual(restored.exportWeights(), before);
    }],
    ['a generation containing only draws leaves valid finite weights and zero win totals', () => {
        const ai = new CardAI();
        const result = ai.endGeneration([]);
        assert.equal(result.totalGames, 0);
        assert.equal(result.playerWins, 0);
        assert.ok(ai.getCardTierList().every(card => Number.isFinite(card.weight)));
    }],
    ['special and generated card logs never expand ordinary learning weights or statistics', () => {
        const ai = new CardAI();
        const control = new CardAI();
        const ordinary = { cardId: 'BASE_001', cardName: '신속 타격', pack: 'base', rarity: 'common' };
        const extra = [
            { cardId: 'STATUS_STRUGGLE' }, { cardId: 'STATUS_RANSOMWARE' },
            { cardId: 'TEMP_CLONE_BASE_001' }, { type: 'effect', source: '전투 로그' }
        ];
        const before = ai.cardWeights.get('BASE_001');
        ai.updateWeights({ cardUsageLog: [ordinary, ...extra] }, 'win');
        control.updateWeights({ cardUsageLog: [ordinary] }, 'win');
        assert.ok(ai.cardWeights.get('BASE_001') > before);
        const record = { enemy: 'T1 미러', deck: [card('BASE_001')], result: { winner: 'player', cardUsageLog: [ordinary] } };
        control.endGeneration([record]);
        ai.endGeneration([{
            ...record,
            deck: [...record.deck, { id: 'STATUS_STRUGGLE' }, { id: 'TEMP_CLONE_BASE_001' }],
            result: { ...record.result, cardUsageLog: [ordinary, ...extra] }
        }]);
        assert.equal(ai.cardWeights.size, 245);
        assert.deepEqual([...ai.cumulativeStats.keys()], ['BASE_001']);
        assert.deepEqual(ai.exportWeights(), control.exportWeights());
    }]
];
