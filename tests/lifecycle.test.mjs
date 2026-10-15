import assert from 'node:assert/strict';
import { BattleEngine } from '../js/engine.js';
import { fixture, card, play, skipTurn } from './helpers.mjs';

export const tests = [
    ['corrosion ticks the opponent shield at the start of the acting side turn', () => {
        const { engine, caster, target } = fixture();
        target.corrosion = 3;
        target.shield = 10;
        engine.startTurn(caster);
        assert.equal(target.hp, 80);
        assert.equal(target.shield, 7);
        assert.equal(target.corrosion, 2);
    }],
    ['rebuild two grants two returns and only the third use goes to void', () => {
        const { engine, state, caster } = fixture();
        play(engine, state, caster, 'DM_007');
        assert.equal(caster.hand.length, 1);
        assert.equal(caster.hand[0].rebuildCount, 1);
        engine._mirrorPlayCard(state, 'A', 0, []);
        assert.equal(caster.hand.length, 1);
        assert.equal(caster.hand[0].rebuildCount, 0);
        engine._mirrorPlayCard(state, 'A', 0, []);
        assert.equal(caster.hand.length, 0);
        assert.equal(caster.voidPile.length, 1);
        assert.equal(caster.totalRebuildsThisBattle, 2);
        assert.equal(caster.shield, 18);
    }],
    ['overclock damage uses existing stacks and the one remaining stack survives next turn', () => {
        const { engine, state, caster, target } = fixture();
        play(engine, state, caster, 'OC_001');
        assert.equal(caster.hp, 76);
        assert.equal(target.hp, 74);
        assert.equal(caster.overclockStacks, 1);
        engine.startTurn(caster);
        assert.equal(caster.overclockStacks, 1);
        caster.overclockStacks = 4;
        caster.overclockUnlimited = true;
        engine.startTurn(caster);
        assert.equal(caster.overclockStacks, 4);
    }],
    ['network stacks, last card and protocol bypass survive a turn boundary', () => {
        const { engine, caster } = fixture();
        caster.networkStacks = 4;
        const lastCard = card('BASE_001');
        caster.lastPlayedCard = lastCard;
        caster.protocolBypassCount = 2;
        engine.startTurn(caster);
        assert.equal(caster.networkStacks, 4);
        assert.equal(caster.lastPlayedCard, lastCard);
        assert.equal(caster.protocolBypassCount, 2);
    }],
    ['weakness affects the whole acting turn and decays after attacks', () => {
        const { engine, state, caster, target } = fixture();
        caster.weakness = 1;
        play(engine, state, caster, 'BASE_001');
        assert.equal(target.hp, 75);
        assert.equal(caster.weakness, 1);
        engine.endTurn(caster);
        assert.equal(caster.weakness, 0);
    }],
    ['carried energy is capped before applying overflow', () => {
        const { engine, caster } = fixture();
        caster.energyCarryOver = true;
        caster.energy = 9;
        caster.overflowNext = 2;
        engine.startTurn(caster);
        assert.equal(caster.energy, 8);
        assert.equal(caster.overflowNext, 0);
    }],
    ['a defending revival core revives before battle victory is announced', () => {
        const { engine, state, caster, target } = fixture();
        target.hp = 2;
        target.activeCores.push({ id: 'TEST_REVIVE', coreEffect: { trigger: 'onDeath' } });
        play(engine, state, caster, 'BASE_001');
        assert.equal(target.hp, 24);
        assert.equal(target.activeCores.length, 0);
        assert.equal(state.winner, null);
    }],
    ['lethal damage stops later effects on the same card', () => {
        const { engine, state, caster, target } = fixture();
        caster.hp = 2;
        target.hp = 1;
        play(engine, state, caster, {
            id: 'TEST_LETHAL', name: 'Lethal', type: 'attack', cost: 0, keywords: [],
            effects: [{ type: 'damage', value: 6 }, { type: 'heal', value: 20 }]
        });
        assert.equal(caster.hp, 2);
        assert.equal(state.winner, 'A');
    }],
    ['draw exhaustion adds struggle and retained struggle damages through shield first', () => {
        const { engine, caster } = fixture();
        caster.drawPile = [];
        engine.startTurn(caster);
        assert.equal(caster.hand[0].id, 'STATUS_STRUGGLE');
        assert.equal(caster.hp, 80);
        caster.shield = 3;
        engine.startTurn(caster);
        assert.equal(caster.hp, 75);
        assert.equal(caster.shield, 0);
        assert.equal(caster.hand.filter(c => c.id === 'STATUS_STRUGGLE').length, 2);
    }],
    ['ransomware damage increases each turn and using it removes it from combat', () => {
        const { engine, state, caster } = fixture();
        caster.hand.push(card('STATUS_RANSOMWARE'));
        engine.startTurn(caster);
        assert.equal(caster.hp, 75);
        engine.startTurn(caster);
        assert.equal(caster.hp, 65);
        engine._mirrorPlayCard(state, 'A', 0, []);
        assert.ok(!caster.hand.some(c => c.id === 'STATUS_RANSOMWARE'));
        assert.ok(!caster.voidPile.some(c => c.id === 'STATUS_RANSOMWARE'));
    }],
    ['reaching the simulator turn limit records a draw instead of assigning a synthetic win', () => {
        const engine = new BattleEngine();
        const state = engine.createMirrorBattleState([], []);
        const result = engine.runMirrorBattle(state, skipTurn, skipTurn, 1);
        assert.equal(result.winner, 'draw');
        assert.equal(result.termination, 'turn_limit');
    }]
];
