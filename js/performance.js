import { BattleEngine } from './engine.js';
import { CardAI } from './ai.js';
import { getAllCards, getCardById } from './cards.js';
import { cloneCard } from './battle-rules.js';
import { newWorldDataVersion } from './newworld-cards.js';

export const EVALUATION_VERSION = 'paired-slot-v1';
export const POLICY_VERSION = 'neutral-cardai-v1';
export const PILOT_CARDS = ['BASE_001', 'BASE_002', 'BASE_005', 'BASE_008', 'BASE_018',
    'BASE_019', 'BASE_027', 'BASE_033', 'BASE_040', 'OC_001', 'OC_021', 'DM_007',
    'DM_014', 'NW_011', 'BIO_026', 'RU_001'];
const ENVIRONMENTS = { 1: [60, 3], 2: [115, 3], 3: [190, 3], 4: [295, 4], 5: [370, 4] };
const EMPTY = { id: 'EVAL_EMPTY', name: '빈 슬롯', type: 'skill', pack: 'evaluation',
    rarity: 'common', tier: 1, cost: 0, effects: [], keywords: [] };
const SCENARIOS = ['basic', 'developed', 'prepared'];
// 시드마다 같은 덱의 한 슬롯을 이 카드 / 빈 슬롯으로 바꿔 각각 선공·후공 2판씩 대전한다
const ARMS = ['candidate', 'empty'];
const CONTEXTS = ['general', 'dedicated'];
// 이전 파일(config.contexts 없음)은 두 덱 모두 측정했다
const contextsOf = config => config.contexts ?? CONTEXTS;
const MIN_TRIALS = 200;      // 카드 한 장의 측정을 확정하는 최소 시드 수
const MIN_TIER_CARDS = 3;    // 티어 기준(중앙값)을 만드는 최소 확정 카드 수
const MIN_RANK_CARDS = 10;   // 티어 안 순위로 등급을 매기는 최소 확정 카드 수
const OP_TOP_SHARE = 0.05;   // OP 경고: 티어 상위 5%이면서 확실히 도움이 되는 카드
// 상위 누적 비율 → 등급: 상위 10% S, 다음 20% A, 중간 40% B, 다음 20% C, 하위 10% D
const GRADE_BANDS = [['S', 0.1], ['A', 0.3], ['B', 0.7], ['C', 0.9], ['D', 1]];
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = value => Math.round(value * 10000) / 10000;

function prepareConditions(source, caster, target, card) {
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (value.condition?.type) {
            const condition = value.condition, amount = condition.value || 0;
            switch (condition.type) {
                case 'hpBelow': caster.hp = Math.min(caster.hp, Math.floor(caster.maxHp * amount / 100)); break;
                case 'targetHpBelow': target.hp = Math.min(target.hp, Math.floor(target.maxHp * amount / 100)); break;
                case 'enemyHasWeakness': target.weakness = Math.max(1, target.weakness); break;
                case 'handEmpty': caster.hand = []; break;
                case 'shieldZero': target.shield = 0; break;
                case 'virusMin': case 'virusTarget': target.virus = Math.max(target.virus, amount); break;
                case 'corrosionTarget': case 'corrosionMin': target.corrosion = Math.max(target.corrosion, amount, 1); break;
                case 'virusAppliedThisTurnMin': target.turn.virusAppliedThisTurn = amount; break;
                case 'dismantledThisBattle': caster.dismantledThisBattle = amount; break;
                case 'dismantledThisTurn': caster.turn.dismantledThisTurn = amount; break;
                case 'networkCardsPlayed': caster.turn.networkCardsPlayedThisTurn = amount; break;
                case 'cardsPlayedThisTurn': caster.turn.cardsPlayedThisTurn = amount; break;
                case 'gambleSuccessThisTurn': caster.turn.gambleSuccessThisTurn = amount; break;
                case 'luckMin': caster.luck = Math.max(caster.luck, amount); break;
                case 'accumulation': card.accumulationCount = Math.max(card.accumulationCount || 0, amount); break;
            }
        }
        for (const child of Object.values(value)) visit(child);
    };
    visit(source);
}

// Every engine/effect/AI random call is synchronous inside this scope. Never await here.
export function withSeed(seed, action) {
    const original = Math.random;
    let value = seed >>> 0;
    Math.random = () => {
        value += 0x6D2B79F5;
        let next = Math.imul(value ^ value >>> 15, value | 1);
        next ^= next + Math.imul(next ^ next >>> 7, next | 61);
        return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
    try { return action(); }
    finally { Math.random = original; }
}

export function interval(values) {
    const average = mean(values);
    if (values.length < 2) return { mean: average, low: null, high: null };
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
    const margin = (values.length < 30 ? 2.58 : 1.96) * Math.sqrt(variance / values.length);
    return { mean: round(average), low: round(average - margin), high: round(average + margin) };
}

function snapshot(entity) {
    const fields = ['hp', 'shield', 'energy', 'strength', 'weakness', 'virus', 'corrosion',
        'networkStacks', 'overclockStacks', 'luck'];
    return Object.fromEntries(fields.map(key => [key, entity[key]]));
}

function observe(engine, caster, subject) {
    const metrics = { damageHp: 0, damageShield: 0, absorbed: 0, healing: 0,
        shieldGenerated: 0, selfDamageHp: 0, selfDamageShield: 0, drawn: 0, paidEnergy: 0, testedUses: 0 };
    const wrap = (name, measure) => {
        const original = engine[name].bind(engine);
        engine[name] = (...args) => measure(original, args);
    };
    wrap('applyDamage', (original, args) => {
        const [target] = args, before = snapshot(target);
        const result = original(...args);
        const hpLost = Math.max(0, before.hp - target.hp), shieldLost = Math.max(0, before.shield - target.shield);
        if (target === caster) metrics.absorbed += shieldLost;
        else { metrics.damageHp += hpLost; metrics.damageShield += shieldLost; }
        return result;
    });
    wrap('applySelfDamage', (original, args) => {
        const [target] = args, before = snapshot(target), result = original(...args);
        if (target === caster) {
            metrics.selfDamageHp += Math.max(0, before.hp - target.hp);
            metrics.selfDamageShield += Math.max(0, before.shield - target.shield);
        }
        return result;
    });
    // Nested effects must not credit the same heal/shield once at each nesting level.
    const frames = [];
    const trace = (owner, name) => {
        const original = owner[name].bind(owner);
        owner[name] = (...args) => {
            const frame = { hp: caster.hp, shield: caster.shield, childHp: 0, childShield: 0 };
            frames.push(frame);
            try { return original(...args); }
            finally {
                frames.pop();
                const hp = caster.hp - frame.hp, shield = caster.shield - frame.shield;
                metrics.healing += Math.max(0, hp - frame.childHp);
                metrics.shieldGenerated += Math.max(0, shield - frame.childShield);
                if (frames.length) {
                    frames.at(-1).childHp += hp;
                    frames.at(-1).childShield += shield;
                }
            }
        };
    };
    trace(engine.effectRegistry, 'execute');
    trace(engine, 'checkCoreTriggers');
    trace(engine, 'heal');
    wrap('drawCards', (original, args) => {
        const result = original(...args);
        if (args[0] === caster) metrics.drawn += result;
        return result;
    });
    wrap('_executeCard', (original, args) => {
        const [entity, , index] = args;
        const cost = engine.canPlayCard(entity, index) ? engine.getEffectiveCost(entity.hand[index], entity) : 0;
        const tested = entity.hand[index] === subject;
        const paid = Math.min(entity.energy, cost), result = original(...args);
        if (entity === caster && result) {
            metrics.paidEnergy += paid;
            metrics.testedUses += Number(tested);
        }
        return result;
    });
    return metrics;
}

export function probeCard(cardId, { scenario = 'basic', seed = 1, followTurns = 5, control = false } = {}) {
    const source = getCardById(cardId);
    if (!source || !SCENARIOS.includes(scenario)) throw new Error('Unknown card or probe scenario.');
    return withSeed(seed, () => {
        const engine = new BattleEngine();
        const [hp, energy] = ENVIRONMENTS[source.tier];
        const deck = Array.from({ length: 30 }, (_, index) => getCardById(index % 2 ? 'BASE_005' : 'BASE_001'));
        const state = engine.createMirrorBattleState(deck, deck, { hp, energy });
        const caster = state.playerA, target = state.playerB, card = cloneCard(control ? EMPTY : source);
        state.turn = 1;
        caster.hand = ['BASE_001', 'BASE_005', 'BASE_001', 'BASE_005'].map(id => cloneCard(getCardById(id)));
        if (scenario !== 'basic') {
            const ready = scenario === 'prepared';
            caster.hp = Math.floor(hp * (ready ? 0.25 : 0.6));
            target.hp = Math.floor(hp * (ready ? 0.4 : 0.6));
            caster.strength = ready ? 5 : 3;
            caster.shield = ready ? 24 : 12;
            caster.overclockStacks = ready ? 4 : 2;
            caster.networkStacks = ready ? 8 : 3;
            caster.luck = ready ? 10 : 5;
            target.virus = ready ? 15 : 6;
            target.shield = ready ? 24 : 12;
            card.accumulationCount = ready ? (card.accumulationTarget || 0) : 0;
            caster.lastPlayedCard = cloneCard(getCardById('BASE_005'));
            if (ready) {
                caster.overflowNext = card.overflowMin || 0;
                const previous = caster.lastPlayedCard;
                if (card.protocolCondition === 'attack') previous.type = 'attack';
                if (card.protocolCondition === 'sameType') previous.type = card.type;
                if (card.protocolCondition === 'differentType') previous.type = card.type === 'skill' ? 'attack' : 'skill';
                if (card.protocolCondition === 'network') previous.keywords = ['network'];
                if (card.protocolCondition === 'costHigher') previous.cost = card.cost + 1;
                if (card.protocolCondition === 'costLower' || card.protocolCondition === 'zeroCost') previous.cost = 0;
                if (card.protocolCondition === 'luckMin') caster.luck = Math.max(caster.luck, card.protocolConditionValue || 0);
                prepareConditions(source, caster, target, card);
            }
        }
        const before = snapshot(caster), enemyBefore = snapshot(target);
        caster.hand.push(card);
        const index = caster.hand.length - 1, effectiveCost = engine.getEffectiveCost(card, caster);
        const metrics = observe(engine, caster, card);
        const playable = engine.canPlayCard(caster, index);
        if (playable) engine._mirrorPlayCard(state, 'A', index);
        const immediate = { ...metrics, shieldChange: caster.shield - before.shield,
            hpChange: caster.hp - before.hp, energyChange: caster.energy - before.energy,
            strengthChange: caster.strength - before.strength,
            weaknessApplied: target.weakness - enemyBefore.weakness,
            virusChange: target.virus - enemyBefore.virus,
            corrosionApplied: target.corrosion - enemyBefore.corrosion,
            shieldRemoved: Math.max(0, enemyBefore.shield - target.shield),
            networkChange: caster.networkStacks - before.networkStacks,
            overclockChange: caster.overclockStacks - before.overclockStacks,
            luckChange: caster.luck - before.luck,
            stateAfter: snapshot(caster), enemyAfter: snapshot(target) };
        const checkpoints = [];
        // This is a scripted follow-up diagnostic, not an estimate of condition frequency.
        for (let turn = 1; playable && turn <= followTurns && !state.winner; turn++) {
            state.turn++;
            engine.endTurn(caster);
            engine.startTurn(caster);
            const rebuilt = caster.hand.indexOf(card);
            if (rebuilt >= 0 && engine.canPlayCard(caster, rebuilt)) engine._mirrorPlayCard(state, 'A', rebuilt);
            for (const id of ['BASE_005', 'BASE_001']) {
                const held = caster.hand.findIndex(next => next !== card && next.id === id);
                if (held >= 0 && engine.canPlayCard(caster, held)) engine._mirrorPlayCard(state, 'A', held);
            }
            if (turn === 3 || turn === 5) checkpoints.push({ turn, ...metrics,
                ownHp: caster.hp, shield: caster.shield, enemyHp: target.hp });
        }
        return { scenario, playable, effectiveCost, before, enemyBefore, immediate, checkpoints,
            attackUnits: playable ? (immediate.damageHp + immediate.damageShield) / 6 : null,
            defenseUnits: playable ? Math.max(0, immediate.shieldChange) / 6 : null,
            uses: metrics.testedUses,
            selfDefeated: state.winner === 'B' };
    });
}

export function measureCard(cardId, samples = 50, seed = 1) {
    return Object.fromEntries(SCENARIOS.map(scenario => {
        const runs = Array.from({ length: samples }, (_, index) => {
            const run = probeCard(cardId, { scenario, seed: seed + index });
            const control = probeCard(cardId, { scenario, seed: seed + index, control: true });
            run.checkpoints = run.checkpoints.map(point => {
                const baseline = control.checkpoints.find(other => other.turn === point.turn);
                return baseline ? Object.fromEntries(Object.keys(point).map(key => [key, key === 'turn' ? point[key] : point[key] - baseline[key]])) : null;
            }).filter(Boolean);
            return run;
        });
        const first = runs[0];
        const numeric = Object.keys(first.immediate).filter(key => typeof first.immediate[key] === 'number');
        return [scenario, { scenario, samples, playableRate: mean(runs.map(run => Number(run.playable))),
            effectiveCost: first.effectiveCost,
            immediate: Object.fromEntries(numeric.map(key => [key, round(mean(runs.map(run => run.immediate[key])))])),
            attackUnits: first.playable ? round(mean(runs.map(run => run.attackUnits))) : null,
            defenseUnits: first.playable ? round(mean(runs.map(run => run.defenseUnits))) : null,
            selfDefeatRate: mean(runs.map(run => Number(run.selfDefeated))),
            uses: round(mean(runs.map(run => run.uses))),
            checkpoints: [3, 5].map(turn => {
                const reached = runs.map(run => run.checkpoints.find(point => point.turn === turn)).filter(Boolean);
                return { turn, reached: reached.length,
                    metrics: reached.length ? Object.fromEntries(Object.keys(reached[0]).map(key => [key, round(mean(reached.map(point => point[key])))])) : null };
            }) }];
    }));
}

function fillDeck(pool, count, offset = 0) {
    const deck = [], installed = new Set();
    for (let index = 0; deck.length < count && index < count * pool.length * 2; index++) {
        const card = pool[(index + offset) % pool.length];
        if (card.type === 'power' && (installed.has(card.id) || installed.size >= 2)) continue;
        deck.push(card);
        if (card.type === 'power') installed.add(card.id);
    }
    if (deck.length !== count) throw new Error('평가 덱을 구성할 수 없습니다.');
    return deck;
}

export function benchmarkDecks(cardId, context = 'general', deckSize = 20, variant = 0) {
    const card = getCardById(cardId), cards = getAllCards();
    if (!card || !CONTEXTS.includes(context) || !Number.isInteger(deckSize) || deckSize < 10 || deckSize > 40)
        throw new Error('Invalid benchmark configuration.');
    const eligible = cards.filter(next => next.tier <= card.tier && next.id !== cardId);
    const base = eligible.filter(next => next.pack === 'base' && next.cost <= 3);
    const pack = eligible.filter(next => next.pack === card.pack && next.cost <= 3);
    const own = context === 'dedicated' && card.pack !== 'base'
        ? [...fillDeck(base, Math.floor((deckSize - 1) / 2), variant),
            ...fillDeck(pack, Math.ceil((deckSize - 1) / 2), variant)]
        : fillDeck(base, deckSize - 1, variant);
    const opponents = ['base', 'overclock', 'dismantle', 'network', 'biohazard', 'russian_roulette'];
    const opponentPack = opponents[variant % opponents.length];
    const opponent = fillDeck(cards.filter(next => next.tier <= card.tier && next.pack === opponentPack && next.cost <= 3), deckSize, variant);
    return { candidate: [card, ...own], empty: [EMPTY, ...own], opponent,
        hp: ENVIRONMENTS[card.tier][0], energy: ENVIRONMENTS[card.tier][1] };
}

function policy() {
    const ai = new CardAI();
    // Metadata and training results do not give the evaluated card a head start.
    for (const id of ai.cardWeights.keys()) ai.cardWeights.set(id, 1);
    ai.generation = 20;
    return (state, engine, phase) => ai.makeDecision(state, engine, phase);
}

export function pairedTrial(cardId, context, seed, { deckSize = 20, maxTurns = 200 } = {}) {
    const decks = benchmarkDecks(cardId, context, deckSize, seed % 6);
    const strategy = policy(), results = {}, usage = { played: 0, uses: 0, draws: 0, selfDefeats: 0 };
    for (const arm of ARMS) {
        const scores = [];
        for (const firstSide of ['A', 'B']) {
            const result = withSeed(seed, () => {
                const engine = new BattleEngine();
                const state = engine.createMirrorBattleState(decks[arm], decks.opponent, decks);
                return engine.runMirrorBattle(state, strategy, strategy, maxTurns, firstSide);
            });
            scores.push(result.winner === 'A' ? 1 : result.winner === 'draw' ? 0.5 : 0);
            if (arm === 'candidate') {
                const uses = result.cardUsageLogA.filter(log => log.cardId === cardId).length;
                usage.played += Number(uses > 0); usage.uses += uses;
                usage.draws += Number(result.winner === 'draw');
                usage.selfDefeats += Number(result.winner === 'B' && result.playerAHp <= 0);
            }
        }
        results[arm] = mean(scores);
    }
    return { seed, ...results, ...usage };
}

export function summarizeTrials(trials) {
    const benefit = interval(trials.map(trial => trial.candidate - trial.empty));
    // 표본 수만으로 확정한다. 등급은 티어 안 순위(rankTiers)로 매긴다.
    const calibrated = trials.length >= MIN_TRIALS;
    return { seeds: trials.length, matches: trials.length * ARMS.length * 2, benefit, calibrated,
        playedRate: mean(trials.map(trial => trial.played / 2)),
        avgUses: mean(trials.map(trial => trial.uses / 2)),
        drawRate: mean(trials.map(trial => trial.draws / 2)),
        defeatRate: mean(trials.map(trial => trial.selfDefeats / 2)),
        scores: Object.fromEntries(ARMS.map(arm => [arm, mean(trials.map(trial => trial[arm]))])),
        trials };
}

// 티어 기준 = 같은 티어에서 확정된 카드(MIN_TIER_CARDS장 이상)의 빈 슬롯 대비 승점 변화 중앙값
export function calibrateTiers(cards) {
    const targets = {};
    for (const tier of [1, 2, 3, 4, 5]) {
        const values = Object.entries(cards).filter(([id, result]) => getCardById(id).tier === tier && result.general?.calibrated)
            .map(([, result]) => result.general.benefit.mean).filter(Number.isFinite).sort((a, b) => a - b);
        if (values.length >= MIN_TIER_CARDS) {
            const median = round((values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2);
            if (median > 0) targets[tier] = median;
        }
    }
    return targets;
}

// 같은 티어에서 확정된 카드를 빈 슬롯 대비 승점 변화 순으로 줄 세워 등급을 매긴다.
// top = 순위 ÷ 카드 수(작을수록 상위), topRange = 승점이 95% 구간 위·아래 끝일 때의 순위 비율.
export function rankTiers(cards) {
    const ranks = {};
    for (const tier of [1, 2, 3, 4, 5]) {
        const entries = Object.entries(cards).filter(([id, result]) => getCardById(id).tier === tier && result.general?.calibrated)
            .map(([id, result]) => ({ id, ...result.general.benefit }));
        if (entries.length < MIN_RANK_CARDS) continue;
        const share = (self, value) => (entries.filter(other => other.id !== self && other.mean > value).length + 1) / entries.length;
        for (const { id, mean: gain, low, high } of entries) {
            const top = share(id, gain);
            ranks[id] = { tier, gain, low, high, top: round(top), topRange: [round(share(id, high)), round(share(id, low))],
                grade: high < 0 ? 'F' : GRADE_BANDS.find(([, limit]) => top <= limit)[0],
                op: top <= OP_TOP_SHARE && low > 0, up: high < 0 };
        }
    }
    return ranks;
}

// 동시 측정 워커 수: 화면용으로 코어 하나를 남기고 1~8개 (8개 위로는 빨라지는 폭이 작다)
export const workerCount = cores => Math.max(1, Math.min(8, (cores || 1) - 1));

// 카드 한 장 측정. 워커와 메인 스레드가 같이 쓴다. 시드로 결과가 정해지므로 어디서 돌려도 같다.
export async function evaluateCard(id, config, { onTrials = () => {}, shouldStop = () => false, yieldEvery = 0 } = {}) {
    const result = { probes: measureCard(id, config.probeSamples, config.seed) };
    for (const context of config.contexts) {
        const trials = [];
        for (let index = 0; index < config.seeds && !shouldStop(); index++) {
            trials.push(pairedTrial(id, context, config.seed + index, config));
            onTrials(context, index + 1);
            if (yieldEvery && index % yieldEvery === yieldEvery - 1) await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (trials.length) result[context] = summarizeTrials(trials);
        if (shouldStop()) break;
    }
    return result;
}

export class PerformanceEvaluator {
    // workers > 1이고 createWorker가 있으면 카드를 워커들에 나눠 동시에 측정한다
    constructor({ workers = 1, createWorker = null } = {}) {
        this.running = false;
        this.workers = createWorker ? workers : 1;
        this.createWorker = createWorker;
        this._abort = null;
    }
    stop() {
        this.running = false;
        this._abort?.();
    }
    // dedicated: 팩 전용 덱도 측정할지. 등급에는 일반 덱만 쓰므로 기본은 끔(측정 시간 약 절반).
    async run({ cardIds = PILOT_CARDS, seeds = 50, probeSamples = 50, seed = 1, deckSize = 20, maxTurns = 200, dedicated = false } = {}, onProgress = () => {}) {
        if (this.running) throw new Error('이미 성능을 측정 중입니다.');
        if (!Number.isInteger(seeds) || seeds < 2 || seeds > 5000 || !Number.isInteger(probeSamples) || probeSamples < 1 || probeSamples > 1000
            || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 200
            || typeof dedicated !== 'boolean')
            throw new Error('평가 시드 수 또는 설정이 유효하지 않습니다.');
        const contexts = dedicated ? CONTEXTS : ['general'];
        const ids = [...new Set(cardIds)];
        if (!ids.length || ids.some(id => !getAllCards().some(card => card.id === id))) throw new Error('평가할 일반 카드를 선택해 주세요.');
        benchmarkDecks(ids[0], 'general', deckSize);
        this.running = true;
        const report = { evaluationVersion: EVALUATION_VERSION, policyVersion: POLICY_VERSION, dataVersion: newWorldDataVersion,
            config: { cardIds: ids, seeds, probeSamples, seed, deckSize, maxTurns, contexts }, status: 'running',
            environments: ENVIRONMENTS, cards: {}, tierTargets: {}, targetSource: 'tier-median-benefit' };
        const total = ids.length * seeds * contexts.length;
        try {
            const results = Math.min(this.workers, ids.length) > 1
                ? await this._runParallel(ids, report.config, total, onProgress)
                : await this._runSequential(ids, report.config, total, onProgress);
            // 보고서에는 요청한 카드 순서대로 넣는다
            for (const id of ids) if (results[id]) report.cards[id] = results[id];
            report.status = this.running ? 'complete' : 'cancelled';
            report.tierTargets = calibrateTiers(report.cards);
            return report;
        } finally {
            this.running = false;
            this._abort = null;
        }
    }

    // 메인 스레드에서 한 장씩. 중지하면 진행 중이던 카드도 그때까지의 표본으로 남긴다.
    async _runSequential(ids, config, total, onProgress) {
        const results = {};
        let current = 0;
        for (const id of ids) {
            if (!this.running) break;
            results[id] = await evaluateCard(id, config, { yieldEvery: 5, shouldStop: () => !this.running,
                onTrials: (context, seeds) => onProgress({ current: ++current, total, cardId: id, context, seeds }) });
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        return results;
    }

    // 워커마다 카드 한 장씩 맡기고 끝나면 다음 카드를 준다(카드마다 걸리는 시간이 달라서).
    // 중지하면 워커를 바로 끝내므로, 진행 중이던 카드는 빠지고 끝난 카드만 남는다.
    _runParallel(ids, config, total, onProgress) {
        return new Promise((resolve, reject) => {
            const queue = [...ids], results = {}, workers = [];
            let current = 0, busy = 0, settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                for (const worker of workers) worker.terminate();
                if (error) reject(error); else resolve(results);
            };
            this._abort = () => finish();
            const dispatch = worker => {
                if (!this.running || !queue.length) {
                    if (busy === 0) finish();
                    return;
                }
                busy++;
                worker.post({ id: queue.shift(), config });
            };
            for (let index = 0; index < Math.min(this.workers, ids.length); index++) {
                const worker = this.createWorker();
                workers.push(worker);
                worker.listen(message => {
                    if (settled) return;
                    if (message.type === 'progress') {
                        current += message.trials;
                        onProgress({ current, total, cardId: message.id, context: message.context, seeds: message.seeds });
                    } else if (message.type === 'done') {
                        busy--;
                        results[message.id] = message.result;
                        dispatch(worker);
                    } else finish(new Error(`성능 측정 워커 오류: ${message.message || '알 수 없음'}`));
                });
            }
            workers.forEach(dispatch);
        });
    }
}

export function validatePerformanceReport(report) {
    if (report == null) return null;
    if (report.evaluationVersion !== EVALUATION_VERSION || report.policyVersion !== POLICY_VERSION
        || report.dataVersion !== newWorldDataVersion || !report.config || !report.cards || !report.tierTargets)
        throw new Error('현재 평가 버전과 다른 성능 파일입니다. 기존 파일은 보관하고 새로 측정해 주세요.');
    if (!['complete', 'cancelled'].includes(report.status)) throw new Error('완료되지 않은 성능 파일입니다.');
    const config = report.config;
    if (!Array.isArray(config.cardIds) || !config.cardIds.length || config.cardIds.length > 245
        || new Set(config.cardIds).size !== config.cardIds.length || config.cardIds.some(id => !getAllCards().some(card => card.id === id))
        || !Number.isInteger(config.seeds) || config.seeds < 2 || config.seeds > 5000
        || !Number.isInteger(config.probeSamples) || config.probeSamples < 1 || config.probeSamples > 1000
        || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff
        || !Number.isInteger(config.deckSize) || config.deckSize < 10 || config.deckSize > 40
        || !Number.isInteger(config.maxTurns) || config.maxTurns < 1 || config.maxTurns > 200)
        throw new Error('유효하지 않은 성능 평가 설정입니다.');
    const contexts = contextsOf(config);
    if (!Array.isArray(contexts) || contexts[0] !== 'general' || contexts.some(context => !CONTEXTS.includes(context))
        || new Set(contexts).size !== contexts.length)
        throw new Error('유효하지 않은 성능 평가 설정입니다.');
    const clean = JSON.parse(JSON.stringify(report));
    for (const [id, result] of Object.entries(report.cards)) {
        if (!config.cardIds.includes(id) || !result.probes) throw new Error('유효하지 않은 카드 성능 데이터입니다.');
        for (const scenario of SCENARIOS) {
            const probe = result.probes[scenario];
            if (!probe || !Number.isInteger(probe.samples) || probe.samples !== config.probeSamples
                || !Number.isFinite(probe.playableRate) || probe.playableRate < 0 || probe.playableRate > 1
                || !Number.isFinite(probe.effectiveCost) || probe.effectiveCost < 0 || !Array.isArray(probe.checkpoints)
                || !probe.immediate || Object.values(probe.immediate).some(value => !Number.isFinite(value)))
                throw new Error('유효하지 않은 조건별 측정값입니다.');
        }
        if (Object.keys(result.probes).some(key => !SCENARIOS.includes(key))) throw new Error('알 수 없는 측정 조건입니다.');
        for (const context of CONTEXTS) {
            const data = result[context];
            if (!contexts.includes(context)) {
                if (data) throw new Error('측정 설정에 없는 덱 결과가 있습니다.');
                continue;
            }
            if (!data && report.status === 'complete') throw new Error('덱별 측정값이 누락되었습니다.');
            if (data && (!Array.isArray(data.trials) || !data.trials.length || data.trials.length > config.seeds
                || (report.status === 'complete' && data.trials.length !== config.seeds)
                || new Set(data.trials.map(trial => trial.seed)).size !== data.trials.length
                || data.trials.some(trial => !Number.isInteger(trial.seed) || trial.seed < config.seed || trial.seed >= config.seed + config.seeds
                    || ARMS.some(arm => !Number.isFinite(trial[arm]) || trial[arm] < 0 || trial[arm] > 1)
                    || ['played', 'uses', 'draws', 'selfDefeats'].some(key => !Number.isInteger(trial[key]) || trial[key] < 0 || trial[key] > (key === 'uses' ? 12000 : 2)))))
                throw new Error('유효하지 않은 전투 표본입니다.');
            if (data) clean.cards[id][context] = summarizeTrials(data.trials);
        }
    }
    if (report.status === 'complete' && Object.keys(report.cards).length !== config.cardIds.length) throw new Error('카드 측정값이 누락되었습니다.');
    clean.tierTargets = calibrateTiers(clean.cards);
    return clean;
}
