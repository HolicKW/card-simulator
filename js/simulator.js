/**
 * simulator.js — 대규모 시뮬레이션 컨트롤러
 * 
 * N판 자동 대전, 세대별 학습 관리.
 * 비동기 실행으로 UI가 멈추지 않도록 처리.
 */

import { BattleEngine } from './engine.js';
import { CardAI } from './ai.js';
import { getAllCards } from './cards.js';

export class Simulator {
    constructor() {
        this.engine = new BattleEngine();
        this.ai = new CardAI();
        this.isRunning = false;
        this.battleLog = []; // 전투별 덱 + 결과 기록
        this.onProgress = null;
        this.onGenerationComplete = null;
        this.onComplete = null;

        // ─── 고급 분석 데이터 ───
        this.synergyData = new Map();    // "cardA|cardB" → { wins, losses }
        this.packComboData = new Map();  // "base+overclock" → { wins, losses }
        this.tierSnapshots = [];         // [{ tierLimit, cardValues: { cardId: ratio } }]
    }

    /**
     * 시뮬레이션 설정
     */
    getDefaultConfig() {
        return {
            gamesPerGeneration: 100,
            generations: 10,
            deckSize: 20,
            tierLimit: 5,
            packs: ['base', 'overclock', 'dismantle'],
            enemyConfigs: [
                {
                    name: '일반 적 (T1)',
                    hp: 50, playerHp: 50,
                    attackPattern: [
                        { type: 'attack', damage: 6 },
                        { type: 'attack', damage: 8 },
                        { type: 'defend', shield: 5 },
                    ]
                },
                {
                    name: '일반 적 (T2)',
                    hp: 100, playerHp: 80,
                    attackPattern: [
                        { type: 'attack', damage: 10 },
                        { type: 'defend', shield: 8 },
                        { type: 'attack', damage: 15 },
                        { type: 'buff', strength: 2 },
                    ]
                },
                {
                    name: '강적 (T3)',
                    hp: 200, playerHp: 150,
                    attackPattern: [
                        { type: 'attack', damage: 15 },
                        { type: 'multiAttack', damage: 6, hits: 3 },
                        { type: 'defend', shield: 15 },
                        { type: 'attack', damage: 20 },
                        { type: 'buff', strength: 3 },
                    ]
                },
                {
                    name: '보스 (T4)',
                    hp: 400, playerHp: 300,
                    attackPattern: [
                        { type: 'attack', damage: 25 },
                        { type: 'multiAttack', damage: 10, hits: 4 },
                        { type: 'defend', shield: 30 },
                        { type: 'attack', damage: 40 },
                        { type: 'buff', strength: 5 },
                        { type: 'attack', damage: 30 },
                    ]
                },
                {
                    name: '최종 보스 (T5)',
                    hp: 700, playerHp: 500,
                    attackPattern: [
                        { type: 'attack', damage: 40 },
                        { type: 'multiAttack', damage: 15, hits: 5 },
                        { type: 'defend', shield: 50 },
                        { type: 'buff', strength: 8 },
                        { type: 'attack', damage: 60 },
                        { type: 'multiAttack', damage: 20, hits: 3 },
                    ]
                }
            ]
        };
    }

    /**
     * 시뮬레이션 실행 (비동기)
     */
    async run(config) {
        this.isRunning = true;
        this.battleLog = [];
        const allGenerationResults = [];

        for (let gen = 0; gen < config.generations; gen++) {
            if (!this.isRunning) break;

            const genResults = [];

            for (let game = 0; game < config.gamesPerGeneration; game++) {
                if (!this.isRunning) break;

                // 랜덤하게 적 선택
                const enemyConfig = config.enemyConfigs[
                    Math.floor(Math.random() * config.enemyConfigs.length)
                ];

                // AI가 덱 빌딩
                const deck = this.ai.buildDeck(
                    config.packs,
                    config.tierLimit,
                    config.deckSize
                );

                if (deck.length < 10) continue;

                // 전투 실행
                const state = this.engine.createBattleState(deck, enemyConfig);
                // opponent 참조 설정 (추출 효과용)
                state.player._opponent = state.enemy;

                const aiStrategy = (s, e, phase) => this.ai.makeDecision(s, e, phase);
                const result = this.engine.runFullBattle(state, aiStrategy);

                // 학습 업데이트
                this.ai.updateWeights(result, result.winner === 'player' ? 'win' : 'lose');

                genResults.push({
                    game: game + 1,
                    enemy: enemyConfig.name,
                    result,
                    deckSize: deck.length,
                    deck: deck.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier }))
                });

                // 전투 로그 저장 (세대당 최대 20건 샘플링)
                if (game < 20) {
                    this.battleLog.push({
                        gen: gen + 1,
                        game: game + 1,
                        enemy: enemyConfig.name,
                        winner: result.winner,
                        turns: result.turns,
                        playerFinalHp: result.playerFinalHp,
                        enemyFinalHp: result.enemyFinalHp,
                        deck: deck.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier })),
                        cardsUsed: result.cardUsageLog?.map(l => l.cardName) || []
                    });
                }

                // 진행 콜백
                if (this.onProgress) {
                    this.onProgress({
                        current: gen * config.gamesPerGeneration + game + 1,
                        total: config.generations * config.gamesPerGeneration,
                        gen: gen + 1,
                        game: game + 1
                    });
                }

                // UI 블로킹 방지: 10게임마다 양보
                if (game % 10 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            // 세대 종료 & 학습 정리
            const genResult = this.ai.endGeneration(genResults);
            allGenerationResults.push(genResult);



            if (this.onGenerationComplete) {
                this.onGenerationComplete(genResult);
            }
        }

        this.isRunning = false;

        if (this.onComplete) {
            this.onComplete(allGenerationResults);
        }

        return allGenerationResults;
    }

    stop() {
        this.isRunning = false;
    }

    /**
     * AI vs AI 미러매치 모드
     * 티어별로 두 AI가 각자 덱을 짜서 대결
     */
    async runMirrorMode(config) {
        this.isRunning = true;

        // 전역 세대 카운터 초기화 (최초 실행 시에만)
        if (typeof this.globalGen === 'undefined') {
            this.globalGen = 0;
        }

        const allResults = [];

        const tierConfigs = [
            { tier: 1, hp: 50, label: 'T1 미러' },
            { tier: 2, hp: 70, label: 'T1-2 미러' },
            { tier: 3, hp: 100, label: 'T1-3 미러' },
            { tier: 4, hp: 150, label: 'T1-4 미러' },
            { tier: 5, hp: 200, label: 'T1-5 미러' },
        ];

        // 선택된 티어 제한까지만 실행
        const activeTierConfigs = tierConfigs.filter(t => t.tier <= config.tierLimit);

        const totalGames = config.gamesPerGeneration * activeTierConfigs.length * config.generations;
        let completedGames = 0;

        for (let gen = 0; gen < config.generations; gen++) {
            if (!this.isRunning) break;

            this.globalGen++; // 누적 세대 ID 증가
            const currentGenId = this.globalGen;

            const genResults = [];

            for (const tc of activeTierConfigs) {
                for (let game = 0; game < config.gamesPerGeneration; game++) {
                    if (!this.isRunning) break;

                    // 두 AI가 각자 덱 빌딩
                    const deckA = this.ai.buildDeck(config.packs, tc.tier, config.deckSize);
                    const deckB = this.ai.buildDeck(config.packs, tc.tier, config.deckSize);

                    if (deckA.length < 10 || deckB.length < 10) continue;

                    // 대칭 전투
                    const state = this.engine.createMirrorBattleState(deckA, deckB, { hp: tc.hp });
                    const aiStratA = (s, e, phase) => this.ai.makeDecision(s, e, phase);
                    const aiStratB = (s, e, phase) => this.ai.makeDecision(s, e, phase);
                    const result = this.engine.runMirrorBattle(state, aiStratA, aiStratB);

                    // AI A가 이기면 A의 카드에 win, B의 카드에 loss
                    const aOutcome = result.winner === 'A' ? 'win' : 'lose';
                    const bOutcome = result.winner === 'B' ? 'win' : 'lose';

                    // ─── 시너지 데이터 수집 (승리 덱의 카드 조합 추적) ───
                    const winDeck = result.winner === 'A' ? deckA : deckB;
                    const loseDeck = result.winner === 'A' ? deckB : deckA;
                    this._trackSynergy(winDeck, true);
                    this._trackSynergy(loseDeck, false);

                    // ─── 팩 교차 분석 (덱의 팩 구성 추적) ───
                    this._trackPackCombo(deckA, aOutcome === 'win');
                    this._trackPackCombo(deckB, bOutcome === 'win');

                    // 학습: A 사이드 사용 카드
                    this.ai.updateWeights({ cardUsageLog: result.cardUsageLogA }, aOutcome);
                    // 학습: B 사이드 사용 카드
                    this.ai.updateWeights({ cardUsageLog: result.cardUsageLogB }, bOutcome);

                    // 합쳐서 기존 형태처럼 저장 (세대 학습용)
                    genResults.push({
                        game: game + 1,
                        enemy: tc.label,
                        result: {
                            winner: 'player', // A가 이기면 "player" 취급
                            turns: result.turns,
                            cardUsageLog: [...result.cardUsageLogA, ...result.cardUsageLogB],
                            playerFinalHp: result.playerAHp,
                            enemyFinalHp: result.playerBHp
                        },
                        deckSize: deckA.length,
                        deck: deckA.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier }))
                    });
                    // 실제 승자로 보정
                    if (result.winner === 'B') genResults[genResults.length - 1].result.winner = 'enemy';

                    // 전투 로그 (세대당 최대 20건 샘플링)
                    if (game < 20) {
                        this.battleLog.push({
                            gen: currentGenId,
                            game: game + 1,
                            mode: 'mirror',

                            tierMatch: tc.label,
                            winner: result.winner,
                            turns: result.turns,
                            playerAHp: result.playerAHp,
                            playerBHp: result.playerBHp,
                            deckA: deckA.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier })),
                            deckB: deckB.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier })),
                            cardsUsedA: result.cardUsageLogA?.map(l => l.cardName) || [],
                            cardsUsedB: result.cardUsageLogB?.map(l => l.cardName) || [],
                            turnLog: result.turnLog || []
                        });
                    }

                    completedGames++;
                    if (this.onProgress) {
                        this.onProgress({
                            current: completedGames,
                            total: totalGames,
                            gen: gen + 1,
                            game: game + 1
                        });
                    }

                    if (game % 10 === 0) {
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }

            const genResult = this.ai.endGeneration(genResults);
            allResults.push(genResult);


            if (this.onGenerationComplete) {
                this.onGenerationComplete(genResult);
            }
        }

        this.isRunning = false;
        if (this.onComplete) this.onComplete(allResults);
        return allResults;
    }

    /**
     * 시너지 데이터 수집: 덱 내 카드 쌍별 동시 등장 승/패 기록
     */
    _trackSynergy(deck, isWin) {
        const uniqueIds = [...new Set(deck.map(c => c.id))];
        for (let i = 0; i < uniqueIds.length; i++) {
            for (let j = i + 1; j < uniqueIds.length; j++) {
                const key = [uniqueIds[i], uniqueIds[j]].sort().join('|');
                if (!this.synergyData.has(key)) {
                    this.synergyData.set(key, { wins: 0, losses: 0, cardA: uniqueIds[i], cardB: uniqueIds[j] });
                }
                const s = this.synergyData.get(key);
                if (isWin) s.wins++; else s.losses++;
            }
        }
    }

    /**
     * 팩 교차 분석: 덱의 팩 구성비 추적
     */
    _trackPackCombo(deck, isWin) {
        const packSet = [...new Set(deck.map(c => c.pack))].sort().join('+');
        if (!this.packComboData.has(packSet)) {
            this.packComboData.set(packSet, { wins: 0, losses: 0 });
        }
        const p = this.packComboData.get(packSet);
        if (isWin) p.wins++; else p.losses++;
    }

    /**
     * 분석 결과 가져오기
     */
    getAnalysis() {
        const tierList = this.ai.getCardTierList();
        const history = this.ai.history;

        // OP/UP 카드 감지 (Baseline 대비 비율로 판정)
        const warnings = [];
        for (const card of tierList) {
            if (card.ratio >= 1.8) {
                warnings.push({
                    type: 'OP', card,
                    message: `${card.name} (T${card.tier}/${card.rarity}) — Baseline 대비 ${Math.round(card.ratio * 100)}%로 같은 티어 내 과도하게 강함`
                });
            }
            if (card.ratio <= 0.4 && (card.totalUses || 0) > 5) {
                warnings.push({
                    type: 'UP', card,
                    message: `${card.name} (T${card.tier}/${card.rarity}) — Baseline 대비 ${Math.round(card.ratio * 100)}%로 같은 티어 내 너무 약함`
                });
            }
        }

        // 팩별 승률
        const packStats = {};
        for (const gen of history) {
            for (const [cardId, stats] of Object.entries(gen.cardStats || {})) {
                const pack = stats.pack || 'unknown';
                if (!packStats[pack]) packStats[pack] = { wins: 0, losses: 0, uses: 0 };
                packStats[pack].wins += stats.wins;
                packStats[pack].losses += stats.losses;
                packStats[pack].uses += stats.uses;
            }
        }

        // ─── 시너지 TOP 20 (승률 기반) ───
        const allCards = getAllCards();
        const cardNameMap = new Map(allCards.map(c => [c.id, c.name]));
        const synergies = [...this.synergyData.values()]
            .filter(s => (s.wins + s.losses) >= 5)
            .map(s => ({
                cardA: s.cardA,
                cardB: s.cardB,
                nameA: cardNameMap.get(s.cardA) || s.cardA,
                nameB: cardNameMap.get(s.cardB) || s.cardB,
                wins: s.wins,
                total: s.wins + s.losses,
                winRate: s.wins / (s.wins + s.losses)
            }))
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 20);

        // ─── 안티시너지 BOTTOM 20 ───
        const antiSynergies = [...this.synergyData.values()]
            .filter(s => (s.wins + s.losses) >= 5)
            .map(s => ({
                cardA: s.cardA,
                cardB: s.cardB,
                nameA: cardNameMap.get(s.cardA) || s.cardA,
                nameB: cardNameMap.get(s.cardB) || s.cardB,
                wins: s.wins,
                total: s.wins + s.losses,
                winRate: s.wins / (s.wins + s.losses)
            }))
            .sort((a, b) => a.winRate - b.winRate)
            .slice(0, 20);

        // ─── 팩 교차 분석 ───
        const packCombos = [...this.packComboData.entries()]
            .map(([combo, data]) => ({
                combo,
                wins: data.wins,
                total: data.wins + data.losses,
                winRate: data.wins / (data.wins + data.losses)
            }))
            .sort((a, b) => b.total - a.total);

        // ─── 티어별 히트맵 (현재 카드 밸류를 티어별로 그룹핑) ───
        const tierHeatmap = {};
        for (const card of tierList) {
            if (!tierHeatmap[card.tier]) tierHeatmap[card.tier] = [];
            tierHeatmap[card.tier].push({
                id: card.id,
                name: card.name,
                pack: card.pack,
                rarity: card.rarity,
                ratio: card.ratio,
                valueTier: card.valueTier,
                totalUses: card.totalUses || 0
            });
        }
        // 각 티어 내 ratio 높은 순 정렬
        for (const tier of Object.keys(tierHeatmap)) {
            tierHeatmap[tier].sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
        }

        return {
            tierList,
            warnings,
            packStats,
            history,
            generation: this.ai.generation,
            synergies,
            antiSynergies,
            packCombos,
            tierHeatmap
        };
    }
}
