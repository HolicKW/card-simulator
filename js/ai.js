/**
 * ai.js — 학습형 AI 에이전트
 * 
 * 카드 선택 가중치를 시뮬레이션 결과에 따라 자동 조정.
 * 선택 가중치는 덱 구성과 행동 정책에만 사용한다.
 * 실측 성능은 performance.js의 고정 정책 교체 실험에서 별도로 구한다.
 */

import { getAllCards, getCardsByPack } from './cards.js';
import { newWorldDataVersion } from './newworld-cards.js';

export const LEARNING_RULESET_VERSION = 'selection-battle-v3';

/**
 * 덱 구성 풀의 등장 배수이자 동일 카드 최대 장수(희귀할수록 적게). NewWorld 희귀도 순서
 * common < rare < epic < unique < legendary를 따른다. 카드 데이터의 모든 희귀도가 여기 있어야 한다.
 */
export const RARITY_COPIES = { common: 4, rare: 3, epic: 2, unique: 1, legendary: 1 };

/**
 * 학습을 시작할 때의 선택 우선도. T1을 1로 정규화한 기존 티어 비율이다.
 * 실제 효과를 측정한 값이나 OP/UP 판정 기준으로 사용하지 않는다.
 */
// Selection priors only; measured performance is stored separately.
const SELECTION_PRIORS = { 1: 1, 2: 1.6667, 3: 2.3333, 4: 3.1111, 5: 3.8889 };

/**
 * 티어 매치별 학습 가중치
 * 고티어 매치(T5)일수록 결과가 가중치 업데이트에 더 크게 반영됨
 */
const TIER_MATCH_WEIGHTS = { 1: 0.75, 2: 0.875, 3: 1.0, 4: 1.15, 5: 1.5 };

export class CardAI {
    constructor() {
        /** 카드별 가중치 (학습 대상) */
        this.cardWeights = new Map();
        /** 카드별 통계 (누적) */
        this.cumulativeStats = new Map();
        /** 학습 세대 */
        this.generation = 0;
        /** 학습 이력 */
        this.history = [];
        /** 학습 속도 (세대가 지날수록 감소) */
        this.learningRate = 0.2;

        this._initWeights();
        this.canonicalCardIds = new Set(this.cardWeights.keys());
    }

    /**
     * 비용은 행동 선택에서 반영한다. 희귀도 자체는 성능 보너스로 쓰지 않는다.
     */
    _initWeights() {
        for (const card of getAllCards()) this.cardWeights.set(card.id, SELECTION_PRIORS[card.tier]);
    }

    /**
     * 덱 구성 (카드풀에서 N장 선택)
     * - 동일 카드 중복은 희귀도별 최대 장수까지 허용 (power는 1장 제한)
     * - 티어 기본값 대비 학습 가중치가 높은 카드 우선, 동률은 무작위
     */
    buildDeck(availablePacks, tierLimit, deckSize = 20) {
        const uniqueCards = [];

        const baseCards = getCardsByPack('base').filter(c => c.tier <= tierLimit);
        uniqueCards.push(...baseCards);

        for (const packId of availablePacks) {
            if (packId === 'base') continue;
            const packCards = getCardsByPack(packId).filter(c => c.tier <= tierLimit);
            uniqueCards.push(...packCards);
        }

        if (uniqueCards.length === 0) return [];

        // 카드풀 구성: 희귀도에 따라 복수 투입. 모르는 희귀도는 기본값으로 넘기지 않는다.
        const pool = [];
        for (const card of uniqueCards) {
            const copies = RARITY_COPIES[card.rarity];
            if (!copies) throw new Error(`덱 구성에 쓸 수 없는 희귀도입니다: ${card.rarity} (${card.id})`);
            for (let i = 0; i < copies; i++) {
                pool.push(card);
            }
        }

        const deck = [];
        const deckCardIds = new Map(); // 덱에 이미 들어간 카드 ID별 횟수
        const addCard = card => {
            const count = deckCardIds.get(card.id) || 0;
            const limit = card.type === 'power' ? 1 : RARITY_COPIES[card.rarity];
            if (count >= limit) return;
            deck.push(card);
            deckCardIds.set(card.id, count + 1);
        };
        const relativeWeight = card => (this.cardWeights.get(card.id) || 1) / (SELECTION_PRIORS[card.tier] || 1);

        // ─── 탐색 보장: 사용 10회 미만 카드 우선 투입 ───
        const MIN_USES = 10;
        const explorationSlots = Math.floor(deckSize / 2); // 덱의 최대 절반까지 탐색용
        const underUsed = uniqueCards.filter(c => {
            const stats = this.cumulativeStats.get(c.id);
            return !stats || stats.uses < MIN_USES;
        });

        // 셔플하여 랜덤하게 탐색
        for (let i = underUsed.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [underUsed[i], underUsed[j]] = [underUsed[j], underUsed[i]];
        }

        for (const card of underUsed) {
            if (deck.length >= explorationSlots) break;
            addCard(card);
        }

        // ─── 나머지: 동률을 섞은 뒤 티어 기본값 대비 가중치가 높은 순 ───
        const sortedPool = [...pool];
        for (let i = sortedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sortedPool[i], sortedPool[j]] = [sortedPool[j], sortedPool[i]];
        }
        sortedPool.sort((a, b) => relativeWeight(b) - relativeWeight(a));

        // 선택 확률 = sigmoid(티어 기본값 대비 편차)
        for (const card of sortedPool) {
            if (deck.length >= deckSize) break;

            const deviation = relativeWeight(card) - 1;
            const prob = 1 / (1 + Math.exp(-deviation * 3));
            const adoptProb = Math.max(0.15, Math.min(0.98, prob));

            if (Math.random() < adoptProb || deck.length < 10) {
                addCard(card);
            }
        }

        const fallbackPool = [...pool];
        while (deck.length < Math.min(deckSize, 10) && fallbackPool.length > 0) {
            const index = Math.floor(Math.random() * fallbackPool.length);
            addCard(fallbackPool.splice(index, 1)[0]);
        }

        return deck;
    }

    /**
     * AI 전략 함수
     */
    makeDecision(state, engine, phase) {
        if (phase === 'mulligan') {
            return this._mulliganStrategy(state);
        }

        const hand = state.player.hand;
        const playable = hand
            .map((card, i) => ({ card, index: i }))
            .filter(({ index }) => engine.canPlayCard(state.player, index));

        if (playable.length === 0) {
            return { action: 'end_turn' };
        }

        let bestCard = null;
        let bestScore = -Infinity;

        for (const { card, index } of playable) {
            let score = this.cardWeights.get(card.id) || 1;

            const hpRatio = state.player.hp / state.player.maxHp;
            const enemyHpRatio = state.enemy.hp / state.enemy.maxHp;

            // 체력 위험 → 방어/회복 우선
            if (hpRatio < 0.3) {
                if ((card.effects || []).some(e => e.type === 'shield' || e.type === 'heal')) {
                    score *= 2.5;
                }
                // 자해 카드는 회피
                if ((card.effects || []).some(e => e.type === 'selfDamage')) {
                    score *= 0.3;
                }
            }

            // 적 체력 낮으면 마무리 공격 우선
            if (enemyHpRatio < 0.3) {
                if (card.type === 'attack') score *= 1.8;
            }

            // 파워 → 빠를수록 가치 높음
            if (card.type === 'power') {
                score *= Math.max(0.5, 2.5 - state.turn * 0.15);
            }

            // 에너지 효율 (코스트당 밸류)
            const effectiveCost = engine.getEffectiveCost(card, state.player);
            const costEfficiency = effectiveCost > 0 ? score / effectiveCost : score * 1.5;
            score = (score + costEfficiency) / 2;

            // 오버클럭 시너지
            if (card.keywords?.includes('overcurrent')) {
                score *= (1 + state.player.overclockStacks * 0.4);
            }
            if (card.keywords?.includes('overclock')) {
                score *= (1 + state.player.overclockStacks * 0.15);
            }

            // 해체 시너지: 패가 많으면 해체 가치 높음
            if (card.keywords?.includes('dismantle') && state.player.hand.length > 5) {
                score *= 1.3;
            }

            // 탐색 노이즈 (세대가 지날수록 줄어듦)
            const noise = 1 - Math.min(this.generation, 20) * 0.02; // 0.6 ~ 1.0
            score *= (1 - noise * 0.1 + Math.random() * noise * 0.2);

            if (score > bestScore) {
                bestScore = score;
                bestCard = { action: 'play_card', cardIndex: index };
            }
        }

        return bestCard || { action: 'end_turn' };
    }

    _mulliganStrategy(state) {
        const hand = state.player.hand;
        const toMulligan = [];

        for (let i = 0; i < hand.length; i++) {
            const card = hand[i];
            if (card.cost >= 3) {
                toMulligan.push(i);
            } else if (card.type === 'power' && Math.random() < 0.5) {
                toMulligan.push(i);
            }
        }

        return toMulligan;
    }

    /**
     * 학습 업데이트: 배틀 결과에 따라 가중치 조정
     * 덱 편입 또는 사용 카드마다 전투당 한 번만 보상한다.
     * tierLevel: 매치 티어 (1~5) — 고티어일수록 업데이트 폭 증가
     */
    updateWeights(result, outcome, tierLevel = 3) {
        if (outcome !== 'win' && outcome !== 'lose') return;
        const ids = new Set([...(result.deck || []).map(c => c.id), ...result.cardUsageLog.map(log => log.cardId)]);
        for (const id of ids) {
            if (!this.canonicalCardIds.has(id)) continue;
            const current = this.cardWeights.get(id), baseline = SELECTION_PRIORS[this._getCardTier(id)];
            let factor = (outcome === 'win' ? 0.05 : -0.05) * (TIER_MATCH_WEIGHTS[tierLevel] || 1);
            if (current < baseline * 0.5 && factor < 0) factor *= 0.4;
            if (current > baseline * 1.5 && factor > 0) factor *= 0.5;
            this.cardWeights.set(id, Math.round(Math.max(0.15, current + factor * this.learningRate) * 10000) / 10000);
        }
    }

    _getCardTier(cardId) {
        const cards = getAllCards();
        const card = cards.find(c => c.id === cardId);
        return card?.tier || 1;
    }

    /**
     * 세대 종료: 편입 전투와 사용 횟수를 분리해 집계한다.
     */
    endGeneration(results) {
        this.generation++;
        const cardStats = new Map();
        for (const record of results) {
            const played = new Map();
            for (const log of record.result.cardUsageLog) {
                if (this.canonicalCardIds.has(log.cardId)) played.set(log.cardId, (played.get(log.cardId) || 0) + 1);
            }
            const ids = new Set([...(record.deck || []).map(c => c.id), ...played.keys()]);
            const won = record.result.winner === 'player', drawn = record.result.winner === 'draw';
            for (const id of ids) {
                if (!this.canonicalCardIds.has(id)) continue;
                const card = getAllCards().find(c => c.id === id);
                if (!cardStats.has(id)) cardStats.set(id, { wins: 0, losses: 0, draws: 0, games: 0,
                    uses: 0, playedGames: 0, name: card.name, pack: card.pack, rarity: card.rarity, byTierMatch: {} });
                const st = cardStats.get(id);
                st.games++; st.wins += Number(won); st.draws += Number(drawn); st.losses += Number(!won && !drawn);
                st.uses += played.get(id) || 0; st.playedGames += Number(played.has(id));
                const tm = st.byTierMatch[record.enemy || 'unknown'] ||= { inclusions: 0, wins: 0, losses: 0, draws: 0 };
                tm.inclusions++; tm.wins += Number(won); tm.draws += Number(drawn); tm.losses += Number(!won && !drawn);
            }
        }
        for (const [id, st] of cardStats) {
            const cum = this.cumulativeStats.get(id) || { wins: 0, losses: 0, draws: 0, uses: 0, playedGames: 0,
                name: st.name, pack: st.pack, rarity: st.rarity, deckInclusions: 0, deckWins: 0,
                deckLosses: 0, deckDraws: 0, byTierMatch: {} };
            for (const key of ['wins', 'losses', 'draws', 'uses', 'playedGames']) cum[key] = (cum[key] || 0) + st[key];
            cum.deckInclusions += st.games; cum.deckWins += st.wins; cum.deckLosses += st.losses; cum.deckDraws += st.draws;
            for (const [label, tm] of Object.entries(st.byTierMatch)) {
                const total = cum.byTierMatch[label] ||= { inclusions: 0, wins: 0, losses: 0, draws: 0 };
                for (const key of Object.keys(tm)) total[key] = (total[key] || 0) + tm[key];
            }
            this.cumulativeStats.set(id, cum);
        }
        this.learningRate = Math.max(0.05, this.learningRate * 0.97);
        const battles = results.filter(r => !r.side || r.side === 'A');
        const summary = { generation: this.generation, weights: Object.fromEntries(this.cardWeights), cardStats: Object.fromEntries(cardStats),
            totalGames: battles.length, perspectiveGames: results.length,
            playerWins: battles.filter(r => r.result.winner === 'player').length,
            draws: battles.filter(r => r.result.winner === 'draw').length, learningRate: Math.round(this.learningRate * 1000) / 1000 };
        this.history.push(summary);
        return summary;
    }

    /**
     * 선택 통계를 반환한다. 실측 성능 등급은 Simulator가 별도로 병합한다.
     */
    getCardTierList() {
        return getAllCards().map(card => {
            const st = this.cumulativeStats.get(card.id), games = st?.deckInclusions || 0, uses = st?.uses || 0;
            return { id: card.id, name: card.name, pack: card.pack, type: card.type, rarity: card.rarity, cost: card.cost, tier: card.tier,
                weight: Math.round(this.cardWeights.get(card.id) * 10000) / 10000, selectionBaseline: SELECTION_PRIORS[card.tier],
                baseline: null, ratio: null, valueTier: '?', totalUses: uses,
                winRate: games ? Math.round(st.wins / games * 100) : null,
                deckInclusions: games, deckWinRate: games ? Math.round(st.deckWins / games * 100) : null,
                playRate: games ? Math.round(st.playedGames / games * 100) : null,
                avgPlaysPerGame: games ? Math.round(uses / games * 100) / 100 : null,
                byTierMatch: Object.fromEntries(Object.entries(st?.byTierMatch || {}).map(([label, tm]) =>
                    [label, { ...tm, winRate: tm.inclusions ? Math.round(tm.wins / tm.inclusions * 100) : null }])) };
        });
    }

    exportWeights() {
        return {
            schemaVersion: 3,
            rulesetVersion: LEARNING_RULESET_VERSION,
            dataVersion: newWorldDataVersion,
            generation: this.generation,
            weights: Object.fromEntries(this.cardWeights),
            cumulativeStats: Object.fromEntries(this.cumulativeStats),
            learningRate: this.learningRate,
            history: this.history
        };
    }

    importWeights(data) {
        if (data?.schemaVersion !== 3 || data.rulesetVersion !== LEARNING_RULESET_VERSION
            || data.dataVersion !== newWorldDataVersion) {
            throw new Error('현재 NewWorld 전투 규칙/카드 데이터와 다른 학습 파일입니다. 기존 파일은 보관하고 새로 학습해 주세요.');
        }
        const weights = Object.entries(data.weights || {});
        if (!Number.isInteger(data.generation) || data.generation < 0 || !Number.isFinite(data.learningRate)
            || data.learningRate <= 0 || data.learningRate > 1 || !Array.isArray(data.history)
            || weights.length !== this.canonicalCardIds.size || weights.some(([id, weight]) =>
                !this.canonicalCardIds.has(id) || !Number.isFinite(weight) || weight <= 0 || weight > 1e6)
            || !data.cumulativeStats || typeof data.cumulativeStats !== 'object') throw new Error('유효하지 않은 NewWorld 선택 가중치 파일입니다.');
        const stats = Object.entries(data.cumulativeStats);
        if (stats.some(([id, value]) => !this.canonicalCardIds.has(id) || !value ||
            ['wins', 'losses', 'draws', 'uses', 'playedGames', 'deckInclusions', 'deckWins', 'deckLosses', 'deckDraws'].some(key =>
                !Number.isSafeInteger(value[key]) || value[key] < 0))) throw new Error('유효하지 않은 NewWorld 전투 통계입니다.');
        const count = value => Number.isInteger(value) && value >= 0;
        const metadata = id => {
            const card = getAllCards().find(card => card.id === id);
            return { name: card.name, pack: card.pack, rarity: card.rarity };
        };
        const validMatches = matches => matches && typeof matches === 'object' && !Array.isArray(matches)
            && Object.entries(matches).every(([label, match]) => (/^T1(?:-[2-5])? 미러$/.test(label) || label === 'unknown')
                && match && ['inclusions', 'wins', 'losses', 'draws'].every(key => count(match[key]))
                && match.wins + match.losses + match.draws === match.inclusions);
        if (stats.some(([, value]) => !validMatches(value.byTierMatch)
            || value.wins + value.losses + value.draws !== value.deckInclusions
            || value.playedGames > value.deckInclusions || value.uses < value.playedGames)
            || data.history.length > 10000 || data.history.some(entry => !entry || !count(entry.generation)
                || !count(entry.totalGames) || !count(entry.playerWins) || !count(entry.draws)
                || entry.playerWins + entry.draws > entry.totalGames || !entry.cardStats
                || Object.entries(entry.cardStats).some(([id, value]) => !this.canonicalCardIds.has(id) || !value
                    || ['wins', 'losses', 'draws', 'games', 'uses', 'playedGames'].some(key => !count(value[key]))
                    || !validMatches(value.byTierMatch)))) throw new Error('유효하지 않은 NewWorld 전투 이력입니다.');
        this.generation = data.generation;
        this.cardWeights = new Map(weights);
        this.cumulativeStats = new Map(stats.map(([id, value]) => [id, { ...value, ...metadata(id) }]));
        this.learningRate = data.learningRate;
        this.history = data.history.map(entry => ({ ...entry, cardStats: Object.fromEntries(
            Object.entries(entry.cardStats).map(([id, value]) => [id, { ...value, ...metadata(id) }])) }));
    }
}
