import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newWorldCards, newWorldSpecialCards } from '../js/newworld-cards.js';
import { getAllCards, getAllPacks, getCardById, getSpecialCardById } from '../js/cards.js';
import { BattleEngine } from '../js/engine.js';
import { hasCoreHandler } from '../js/core-effects.js';
import { cloneCard, hasKeyword, roundToInt } from '../js/battle-rules.js';
import { fixture, card, withRandom } from './helpers.mjs';

function nestedEffects(effects) {
    return (effects || []).flatMap(effect => [effect,
        ...nestedEffects(effect.effects), ...nestedEffects(effect.thenEffects), ...nestedEffects(effect.elseEffects)]);
}

export const tests = [
    ['generated browser data matches the canonical vendored snapshots', async () => {
        const ordinary = JSON.parse(await readFile(new URL('../js/data/cards.json', import.meta.url), 'utf8'));
        const special = JSON.parse(await readFile(new URL('../js/data/specialCards.json', import.meta.url), 'utf8'));
        assert.deepEqual(newWorldCards, ordinary.cards);
        assert.deepEqual(newWorldSpecialCards, special.cards);
        assert.equal(getAllCards().length, 245);
        assert.equal(newWorldSpecialCards.length, 2);
        assert.equal(new Set([...newWorldCards, ...newWorldSpecialCards].map(card => card.id)).size, 247);
        assert.equal(getAllPacks().find(pack => pack.id === 'IP').totalCards, 5);
        assert.ok(!getAllPacks().some(pack => pack.id === 'special'));
    }],
    ['presentation aliases preserve every native effect, core and cost field', () => {
        const typeMap = { Attack: 'attack', Skill: 'skill', Core: 'power' };
        for (const source of [...newWorldCards, ...newWorldSpecialCards]) {
            const card = getCardById(source.id);
            for (const [key, value] of Object.entries(source)) {
                if (key === 'type') assert.equal(card.type, typeMap[value], source.id);
                else if (key === 'rarity') assert.equal(card.rarity, value.toLowerCase(), source.id);
                else if (key === 'description') assert.equal(card.rawDescription, value, source.id);
                else assert.deepEqual(card[key], value, `${source.id}.${key}`);
            }
            assert.equal(card.name, source.cardName);
            assert.ok(!/\{(?:d(?:hp)?:)?\d+\}/.test(card.description), source.id);
        }
        assert.equal(getSpecialCardById('STATUS_STRUGGLE').type, 'attack');
        assert.equal(getSpecialCardById('STATUS_RANSOMWARE').cost, 1);
    }],
    ['every canonical effect including nested and special-card effects has a handler', () => {
        const engine = new BattleEngine();
        const missing = new Set();
        for (const card of [...newWorldCards, ...newWorldSpecialCards]) {
            for (const effect of nestedEffects([
                ...(card.effects || []), ...(card.accumulationEffects || []),
                ...(card.protocolEffects || []), ...(card.extractEffects || []),
                ...(card.coreEffect?.effects || [])
            ])) {
                if (!engine.effectRegistry.handlers.has(effect.type)) missing.add(effect.type);
            }
        }
        assert.deepEqual([...missing].sort(), []);
    }],
    ['damage rounding matches Mathf at positive and negative half ties', () => {
        assert.deepEqual([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.6].map(roundToInt), [-2, -2, 0, 0, 2, 2, 4]);
    }],
    ['every canonical custom core has a handler or engine-managed death trigger', () => {
        const missing = new Set();
        for (const card of newWorldCards) {
            const core = card.coreEffect;
            if (core?.coreType && core.trigger !== 'onDeath' && !hasCoreHandler(core.coreType)) missing.add(core.coreType);
        }
        assert.deepEqual([...missing].sort(), []);
    }],
    ['explicit card copies preserve runtime accumulation without sharing effect mutations', () => {
        const source = cloneCard(getCardById('DM_007'));
        source.rebuildCount = 1;
        source.accumulationCount = 4;
        source.isTemporary = true;
        const copy = cloneCard(source);
        copy.effects[0].value = 99;
        assert.equal(source.effects[0].value, 6);
        assert.equal(copy.rebuildCount, 1);
        assert.equal(copy.accumulationCount, 4);
        assert.equal(copy.isTemporary, true);
        assert.ok(hasKeyword(copy, 'rebuild'));
    }],
    ['every canonical card executes without non-finite combat state', () => withRandom([0.5], () => {
        for (const source of [...newWorldCards, ...newWorldSpecialCards]) {
            const { engine, state, caster, target } = fixture({ hp: 100000, energy: 1000 });
            caster.hand = [card(source.id)];
            caster.overclockStacks = 10;
            caster.overflowNext = 100;
            caster.networkStacks = 10;
            caster.luck = 10;
            target.virus = 100;
            assert.equal(engine._mirrorPlayCard(state, 'A', 0, []), true, source.id);
            for (const entity of [caster, target]) {
                for (const key of ['hp', 'maxHp', 'shield', 'energy', 'strength', 'weakness', 'virus', 'corrosion', 'overclockStacks']) {
                    assert.ok(Number.isFinite(entity[key]), `${source.id}: ${key}=${entity[key]}`);
                }
            }
        }
    })]
];
