/**
 * ai.js — 학습형 AI 에이전트
 * 
 * 카드 선택 가중치를 시뮬레이션 결과에 따라 자동 조정.
 * - 초기: 코스트 효율 + 티어 기대밸류 기반 휴리스틱
 * - 학습: 승패 기반 가중치 업데이트 (ELO 방식)
 * - 핵심: 고티어 카드는 "설계상 더 강해야 함"을 기본 전제로 인식
 *   → 티어별 Baseline을 두고, 같은 티어 내에서의 상대적 밸류를 학습
 *   → 교차 티어 비교는 "기대값 대비 초과/미달"로 판단
 */

import { getAllCards, getCardsByPack } from './cards.js';

/**
 * 티어별 기대 밸류 Baseline
 * 설계 의도: "고 티어 = 더 강한 카드가 나와야 정상"
 * 이 값 자체를 넘는 카드가 진짜 OP, 못 미치는 카드가 UP
 */
const TIER_BASELINES = {
    1: 1.2,   // T1: 기초 카드, 기대 밸류 낮음
    2: 2.2,   // T2: 시너지 시작, 중간 밸류
    3: 3.5,   // T3: 본격 피니셔급, 높은 밸류
    4: 4.5,   // T4: 상위 카드, 매우 높은 밸류
    5: 5.5,   // T5: 끝판왕, 최고 밸류
};

/**
 * 희귀도별 기대 밸류 보정
 */
const RARITY_MULTIPLIER = {
    common: 0.8,
    rare: 1.0,
    epic: 1.3,
    unique: 1.6,
    legendary: 2.0,
};

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
        this.learningRate = 0.15;

        this._initWeights();
    }

    /**
     * 초기 가중치: 티어 Baseline × 희귀도 보정
     * 고티어 카드는 태생적으로 높은 초기 가중치를 가짐 → 정상
     * 학습은 이 Baseline으로부터의 편차를 조정
     */
    _initWeights() {
        const cards = getAllCards();
        for (const card of cards) {
            const tierBase = TIER_BASELINES[card.tier] || 1.0;
            const rarityMul = RARITY_MULTIPLIER[card.rarity] || 1.0;
            // 코스트 효율 보정: 저코스트일수록 약간 가산 (유연성 가치)
            const costEfficiency = 1 + (3 - Math.min(card.cost, 3)) * 0.05;
            const base = tierBase * rarityMul * costEfficiency;
            this.cardWeights.set(card.id, Math.round(base * 100) / 100);
        }
    }

    /**
     * 덱 구성 (카드풀에서 N장 선택)
     * - 동일 카드 중복 허용 (power만 1장 제한)
     * - 희귀도별 등장 배수: 높은 희귀도일수록 풀에 적게 등장
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

        // 희귀도별 풀 등장 배수 (획득 확률 시뮬레이션)
        const rarityMultiplier = {
            common: 4,
            uncommon: 3,
            rare: 2,
            legendary: 1
        };

        // 카드풀 구성: 희귀도에 따라 복수 투입
        const pool = [];
        for (const card of uniqueCards) {
            const mult = rarityMultiplier[card.rarity] || 2;
            for (let i = 0; i < mult; i++) {
                pool.push(card);
            }
        }

        const deck = [];
        const powerCount = new Map(); // power 카드 ID → 투입 횟수
        const deckCardIds = new Map(); // 덱에 이미 들어간 카드 ID별 횟수

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
            if (card.type === 'power') {
                if (powerCount.get(card.id)) continue;
                powerCount.set(card.id, 1);
            }
            deck.push(card);
            deckCardIds.set(card.id, (deckCardIds.get(card.id) || 0) + 1);
        }

        // ─── 나머지: 가중치 기반 정렬 (높은 순) ───
        const sortedPool = [...pool].sort((a, b) => {
            return (this.cardWeights.get(b.id) || 1) - (this.cardWeights.get(a.id) || 1);
        });

        // 선택 확률 = sigmoid(가중치 - 티어 기대값)
        for (const card of sortedPool) {
            if (deck.length >= deckSize) break;

            // power 타입은 1장 제한
            if (card.type === 'power') {
                if (powerCount.get(card.id)) continue;
                powerCount.set(card.id, 1);
            }

            const w = this.cardWeights.get(card.id) || 1;
            const baseline = TIER_BASELINES[card.tier] || 1;
            const deviation = (w - baseline) / baseline;
            const prob = 1 / (1 + Math.exp(-deviation * 3));
            const adoptProb = Math.max(0.15, Math.min(0.98, prob));

            if (Math.random() < adoptProb || deck.length < 10) {
                deck.push(card);
            }
        }

        while (deck.length < Math.min(10, pool.length)) {
            const randCard = pool[Math.floor(Math.random() * pool.length)];
            if (randCard.type === 'power' && powerCount.get(randCard.id)) continue;
            if (randCard.type === 'power') powerCount.set(randCard.id, 1);
            deck.push(randCard);
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
        const energy = state.player.energy;

        const playable = hand
            .map((card, i) => ({ card, index: i }))
            .filter(({ card }) => card.cost <= energy);

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
            const costEfficiency = card.cost > 0 ? score / card.cost : score * 1.5;
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
     * 핵심: "그 카드의 티어 Baseline 대비" 얼마나 기여했느냐로 조정
     */
    updateWeights(result, outcome) {
        // 승리 시 → 사용한 카드들이 기여한 것 → 가중치 증가
        // 패배 시 → 사용한 카드들이 부족한 것 → 가중치 감소 (단, Baseline 이하로는 느리게 감소)
        const baseFactor = outcome === 'win' ? 0.06 : -0.04;

        // 전투 중 카드의 실질 기여도 추정
        const totalDamageTaken = result.cardUsageLog.length > 0
            ? result.cardUsageLog[result.cardUsageLog.length - 1]?.enemyHpAfter || 0
            : 0;

        for (const log of result.cardUsageLog) {
            const current = this.cardWeights.get(log.cardId) || 1;
            const baseline = TIER_BASELINES[this._getCardTier(log.cardId)] || 1;

            let factor = baseFactor;
            // Baseline 아래면 감소 속도를 절반으로 (고티어 카드를 너무 빨리 떨구지 않도록)
            if (current < baseline && factor < 0) {
                factor *= 0.5;
            }
            // Baseline 위에서 증가는 점점 둔화 (천장 효과)
            if (current > baseline * 1.5 && factor > 0) {
                factor *= 0.5;
            }

            const newWeight = Math.max(0.2, current + factor * this.learningRate);
            this.cardWeights.set(log.cardId, Math.round(newWeight * 100) / 100);
        }
    }

    _getCardTier(cardId) {
        const cards = getAllCards();
        const card = cards.find(c => c.id === cardId);
        return card?.tier || 1;
    }

    /**
     * 세대 종료: 전체 시뮬레이션 결과 기반으로 가중치 정규화
     */
    endGeneration(results) {
        this.generation++;

        // 카드별 승률 계산
        const cardStats = new Map();
        for (const r of results) {
            for (const log of r.result.cardUsageLog) {
                if (!cardStats.has(log.cardId)) {
                    cardStats.set(log.cardId, { wins: 0, losses: 0, uses: 0, name: log.cardName, pack: log.pack, rarity: log.rarity });
                }
                const stats = cardStats.get(log.cardId);
                stats.uses++;
                if (r.result.winner === 'player') stats.wins++;
                else stats.losses++;
            }
        }

        // ─── 티어 인식 ELO 업데이트 ───
        // 핵심: 같은 티어 내에서의 상대 순위로 조정
        // "T1 커먼이 승률 80%면 그건 OP, T5 레전이 승률 80%면 그건 정상"
        const tierGroups = {};
        for (const [cardId, stats] of cardStats) {
            const tier = this._getCardTier(cardId);
            if (!tierGroups[tier]) tierGroups[tier] = [];
            tierGroups[tier].push({ cardId, stats, winRate: stats.uses > 0 ? stats.wins / stats.uses : 0.5 });
        }

        for (const [tier, cards] of Object.entries(tierGroups)) {
            const baseline = TIER_BASELINES[tier] || 1;
            // 같은 티어 내에서의 평균 승률 계산
            const avgWinRate = cards.reduce((sum, c) => sum + c.winRate, 0) / cards.length;

            for (const { cardId, stats, winRate } of cards) {
                const current = this.cardWeights.get(cardId) || baseline;

                // 티어 내 상대 편차: 같은 티어 평균 승률 대비 얼마나 좋은지/나쁜지
                const relativePerformance = winRate - avgWinRate;

                // 전체 게임 대비 사용 빈도 (많이 사용될수록 데이터 신뢰도 높음)
                const confidence = Math.min(1, stats.uses / (results.length * 0.3));

                // 조정량: 상대 편차 × 학습률 × 신뢰도
                const adjustment = relativePerformance * this.learningRate * confidence;

                const newWeight = Math.max(
                    baseline * 0.3, // 최소값: Baseline의 30% (해당 티어 최하위)
                    current + adjustment
                );
                this.cardWeights.set(cardId, Math.round(newWeight * 100) / 100);
            }
        }

        // 학습률 감쇠 (안정화)
        this.learningRate = Math.max(0.03, this.learningRate * 0.92);

        // 누적 통계 업데이트
        for (const [cardId, stats] of cardStats) {
            if (!this.cumulativeStats.has(cardId)) {
                this.cumulativeStats.set(cardId, { wins: 0, losses: 0, uses: 0, name: stats.name, pack: stats.pack, rarity: stats.rarity });
            }
            const cum = this.cumulativeStats.get(cardId);
            cum.wins += stats.wins;
            cum.losses += stats.losses;
            cum.uses += stats.uses;
        }

        // 이력 저장
        this.history.push({
            generation: this.generation,
            weights: Object.fromEntries(this.cardWeights),
            cardStats: Object.fromEntries(cardStats),
            totalGames: results.length,
            playerWins: results.filter(r => r.result.winner === 'player').length,
            learningRate: Math.round(this.learningRate * 1000) / 1000
        });

        return this.history[this.history.length - 1];
    }

    /**
     * 현재 카드 밸류 티어 리스트 반환
     * 핵심: "기대 Baseline 대비 초과/미달"로 평가
     */
    getCardTierList() {
        const cards = getAllCards();
        const tierList = cards.map(card => {
            const w = this.cardWeights.get(card.id) || 1;
            const baseline = TIER_BASELINES[card.tier] || 1;
            // Baseline 대비 비율로 밸류 등급 판정
            const ratio = w / baseline;

            // 누적 통계 병합
            const cumStats = this.cumulativeStats.get(card.id);
            const totalUses = cumStats?.uses || 0;
            const winRate = totalUses > 0 ? Math.round((cumStats.wins / totalUses) * 100) : null;

            // 사용 데이터 없으면 미평가
            let valueTier;
            if (totalUses === 0) {
                valueTier = '?';
            } else if (ratio >= 1.5) valueTier = 'S';
            else if (ratio >= 1.2) valueTier = 'A';
            else if (ratio >= 0.9) valueTier = 'B';
            else if (ratio >= 0.65) valueTier = 'C';
            else if (ratio >= 0.45) valueTier = 'D';
            else valueTier = 'F';

            return {
                id: card.id,
                name: card.name,
                pack: card.pack,
                type: card.type,
                rarity: card.rarity,
                cost: card.cost,
                tier: card.tier,
                weight: Math.round(w * 100) / 100,
                baseline: baseline,
                ratio: Math.round(ratio * 100) / 100,
                valueTier,
                totalUses,
                winRate
            };
        });

        return tierList.sort((a, b) => b.ratio - a.ratio);
    }

    exportWeights() {
        return {
            generation: this.generation,
            weights: Object.fromEntries(this.cardWeights),
            cumulativeStats: Object.fromEntries(this.cumulativeStats),
            learningRate: this.learningRate,
            history: this.history
        };
    }

    importWeights(data) {
        this.generation = data.generation || 0;
        this.cardWeights = new Map(Object.entries(data.weights || {}));
        this.cumulativeStats = new Map(Object.entries(data.cumulativeStats || {}));
        this.learningRate = data.learningRate || 0.15;
        this.history = data.history || [];
    }
}
