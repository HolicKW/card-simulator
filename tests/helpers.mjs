import { BattleEngine } from '../js/engine.js';
import { getCardById } from '../js/cards.js';
import { cloneCard } from '../js/battle-rules.js';

export function card(id) {
    const data = getCardById(id);
    if (!data) throw new Error(`Missing fixture card: ${id}`);
    return cloneCard(data);
}

export function fixture(config = {}) {
    const engine = new BattleEngine();
    const filler = {
        id: 'TEST_FILLER', name: 'Fixture', cardName: 'Fixture', pack: 'test',
        type: 'skill', rarity: 'common', tier: 1, cost: 0, keywords: [], effects: []
    };
    const deck = Array.from({ length: 20 }, () => cloneCard(filler));
    const state = engine.createMirrorBattleState(deck, deck, config);
    state.turn = 1;
    return { engine, state, caster: state.playerA, target: state.playerB };
}

export function skipTurn(_state, _engine, phase) {
    return phase === 'mulligan' ? [] : { action: 'end_turn' };
}

export function play(engine, state, entity, data) {
    entity.hand.push(typeof data === 'string' ? card(data) : data);
    return engine._mirrorPlayCard(state, entity === state.playerA ? 'A' : 'B', entity.hand.length - 1, []);
}

export function context(engine, caster, target, effect, sourceCard = null) {
    return engine.makeContext(caster, target, sourceCard, effect);
}

export function withRandom(values, callback) {
    const original = Math.random;
    let index = 0;
    Math.random = () => values[Math.min(index++, values.length - 1)];
    try { return callback(); }
    finally { Math.random = original; }
}
