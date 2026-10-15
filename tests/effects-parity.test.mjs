import assert from 'node:assert/strict';
import { card, fixture, context, withRandom } from './helpers.mjs';

function effects(engine, caster, target, source) {
    engine.executeEffects(source.effects, context(engine, caster, target, null, source));
}

export const tests = [
    ['master override executes one highest-cost attack or skill and preserves the existing hand', () => {
        const { engine, caster, target } = fixture({ hp: 200 });
        const held = card('BASE_005'), attack = card('BASE_001'), skill = card('BASE_007'), core = card('BASE_033');
        attack.cost = 4;
        skill.cost = 2;
        core.cost = 9;
        caster.hand = [held];
        caster.drawPile = [skill, core, attack];
        const energyBefore = caster.energy;
        effects(engine, caster, target, card('NW_035'));
        assert.equal(target.hp, 194);
        assert.deepEqual(caster.hand, [held, attack]);
        assert.equal(attack.cost, 4);
        assert.equal(caster.energy, energyBefore);
        assert.deepEqual(caster.drawPile, [skill, core]);
        assert.equal(caster.turn.cardsPlayedThisTurn, 1);
        assert.equal(caster.lastPlayedCard, attack);
    }],
    ['thread sync counts a lone card cost once and commits its dismantle', () => {
        const { engine, caster, target } = fixture({ hp: 100 });
        const held = card('BASE_005');
        held.cost = 3;
        caster.hand = [held];
        caster.networkStacks = 4;
        effects(engine, caster, target, card('NW_028'));
        assert.equal(target.hp, 88);
        assert.equal(caster.hand.length, 0);
        assert.deepEqual(caster.voidPile, [held]);
        assert.equal(caster.turn.dismantledThisTurn, 1);
    }],
    ['system rollback stores the original hand without dismantling and restores it at turn end', () => {
        const { engine, caster, target } = fixture();
        const original = card('BASE_005'), recent = card('BASE_001');
        caster.hand = [original];
        caster.voidPile = [recent];
        effects(engine, caster, target, card('DM_034'));
        assert.deepEqual(caster.hand, [recent]);
        assert.deepEqual(caster.rollbackStoredHand, [original]);
        assert.equal(caster.turn.dismantledThisTurn, 0);
        assert.equal(recent.isTemporary, true);
        engine.endTurn(caster);
        assert.deepEqual(caster.hand, [original]);
        assert.deepEqual(caster.voidPile, [recent]);
        assert.deepEqual(caster.rollbackStoredHand, []);
    }],
    ['armor pierce applies to every hit of the next attack and then is consumed', () => {
        const { engine, caster, target } = fixture({ hp: 100 });
        target.shield = 50;
        engine.executeEffects([{ type: 'armorPierce', value: 1 }, { type: 'damage', value: 4, hits: 3 }],
            context(engine, caster, target, null));
        assert.equal(target.hp, 88);
        assert.equal(target.shield, 50);
        assert.equal(caster.turn.armorPierceNextAttack, false);
        engine.executeEffects([{ type: 'damage', value: 4 }], context(engine, caster, target, null));
        assert.equal(target.hp, 88);
        assert.equal(target.shield, 46);
    }],
    ['deck dismantle triggers extraction, rebuild return and the first-dismantle core', () => {
        const { engine, caster, target } = fixture({ hp: 100 });
        const extracted = card('DM_002');
        extracted.rebuildCount = 1;
        const draw1 = card('BASE_005'), draw2 = card('BASE_007');
        caster.drawPile = [extracted, draw1, draw2];
        caster.activeCores = [card('DM_038')];
        engine.executeEffects([{ type: 'dismantleTop', value: 1 }], context(engine, caster, target, null));
        assert.equal(target.hp, 86);
        assert.equal(caster.energy, 5);
        assert.deepEqual(caster.hand, [extracted, draw1, draw2]);
        assert.equal(extracted.rebuildCount, 0);
        assert.equal(caster.totalRebuildsThisBattle, 1);
        assert.equal(caster.turn.dismantledThisTurn, 1);
        assert.equal(caster.voidPile.length, 0);
    }],
    ['resource conversions preserve shield remainders and use the native healing ratio', () => {
        const { engine, caster, target } = fixture({ hp: 100 });
        caster.shield = 25;
        effects(engine, caster, target, card('BASE_025'));
        assert.equal(caster.shield, 5);
        assert.equal(caster.energy, 6);
        caster.hp = 20;
        caster.energy = 2;
        effects(engine, caster, target, card('BASE_030'));
        assert.equal(caster.hp, 56);
        assert.equal(caster.energy, 0);
    }],
    ['zero-cost draws retain their own original costs for end-of-turn restoration', () => {
        const { engine, caster, target } = fixture();
        const draws = [card('BASE_001'), card('BASE_006'), card('BASE_027')];
        draws.forEach((item, index) => { item.cost = index + 1; });
        caster.drawPile = [...draws];
        effects(engine, caster, target, card('BASE_035'));
        assert.deepEqual(draws.map(item => item.cost), [0, 0, 0]);
        assert.equal(caster.deferredActions.length, 3);
        engine.endTurn(caster);
        assert.deepEqual(draws.map(item => item.cost), [1, 2, 3]);
    }],
    ['network cloning creates an independent temporary copy of a matching hand card', () => {
        const { engine, caster, target } = fixture();
        const source = card('NW_001'), other = card('BASE_001');
        caster.hand = [other, source];
        withRandom([0], () => effects(engine, caster, target, card('NW_016')));
        const copy = caster.hand[2];
        assert.equal(copy.id, `${source.id}_TEMP_CLONE`);
        assert.equal(copy.isTemporary, true);
        assert.ok(copy.keywords.includes('일시적'));
        assert.notEqual(copy.effects, source.effects);
        assert.equal(source.isTemporary, false);
        engine.endTurn(caster);
        assert.deepEqual(caster.hand, [other, source]);
        assert.ok(caster.voidPile.includes(copy));
    }],
    ['IP open access searches the declared type and broadcasts preserve the caster debuffs', () => {
        const { engine, caster, target } = fixture();
        const top = card('BASE_001'), skill = card('BASE_005'), lastAttack = card('BASE_002');
        caster.drawPile = [top, skill, lastAttack];
        engine.executeEffects([{ type: 'openAccessDraw', filter: 'attack' }], context(engine, caster, target, null, card('IP_001')));
        assert.deepEqual(caster.hand, [top, lastAttack]);
        assert.deepEqual(caster.drawPile, [skill]);
        caster.weakness = 2;
        caster.virus = 3;
        caster.corrosion = 4;
        effects(engine, caster, target, card('IP_003'));
        assert.deepEqual([target.weakness, target.virus, target.corrosion], [2, 3, 4]);
        assert.deepEqual([caster.weakness, caster.virus, caster.corrosion], [2, 3, 4]);
        assert.equal(target.turn.virusAppliedThisTurn, 3);
    }],
];
