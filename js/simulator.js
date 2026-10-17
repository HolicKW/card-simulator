/**
 * simulator.js — 대규모 시뮬레이션 컨트롤러
 * 
 * N판 자동 대전, 세대별 학습 관리.
 * 비동기 실행으로 UI가 멈추지 않도록 처리.
 */

import { BattleEngine } from './engine.js';
import { CardAI } from './ai.js';
import { getAllCards, getCardOverrides, overridesKey } from './cards.js';

const reportKey = report => overridesKey(report?.config?.overrides ?? {});
import { PerformanceEvaluator, validatePerformanceReport, rankTiers, workerCount } from './performance.js';

// 브라우저에서는 Web Worker로 성능 측정을 나눠 돌린다 (Node 테스트에서는 메인 스레드에서 순차 실행)
const browserWorkers = typeof window !== 'undefined' && typeof Worker !== 'undefined' ? {
    workers: workerCount(navigator.hardwareConcurrency),
    createWorker: () => {
        const worker = new Worker(new URL('./performance-worker.js', import.meta.url), { type: 'module' });
        return {
            post: message => worker.postMessage(message),
            listen: handler => {
                worker.onmessage = event => handler(event.data);
                worker.onerror = event => handler({ type: 'error', message: event.message });
            },
            terminate: () => worker.terminate()
        };
    }
} : {};

// 등급 순(S→?)으로, 같은 등급 안에서는 실측 카드를 상위 순위부터, 잠정 카드는 비율 높은 순으로
const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5, '?': 6 };
const score = card => card.measured ? 10 - card.measured.top : card.ratio ?? -1;
const byGrade = (a, b) => GRADE_ORDER[a.valueTier] - GRADE_ORDER[b.valueTier] || score(b) - score(a);

export class Simulator {
    constructor() {
        this.engine = new BattleEngine();
        this.ai = new CardAI();
        this.evaluator = new PerformanceEvaluator(browserWorkers);
        this.performanceReport = null;   // 가장 최근 측정 (어떤 수정 상태든)
        this.baselineReport = null;      // 수정 없이 측정한 가장 최근 결과 (비교 기준)
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
            packs: ['base', 'overclock', 'dismantle', 'network', 'biohazard', 'russian_roulette', 'IP'],
        };
    }

    stop() {
        this.isRunning = false;
        this.evaluator.stop();
    }

    async runPerformance(config, onProgress) {
        if (this.isRunning || this.evaluator.running) throw new Error('진행 중인 작업을 먼저 마쳐 주세요.');
        const report = await this.evaluator.run(config, onProgress);
        this._storeReport(report);
        return report;
    }

    _storeReport(report) {
        this.performanceReport = report;
        if (report && reportKey(report) === overridesKey({})) this.baselineReport = report;
    }

    // 지금 카드 수정 상태로 측정한 결과. 다른 수치로 측정한 결과는 등급에 쓰지 않는다.
    activeReport() {
        const key = overridesKey(getCardOverrides());
        return [this.performanceReport, this.baselineReport].find(report => report && reportKey(report) === key) ?? null;
    }

    exportData() {
        return { ...this.ai.exportWeights(), performance: this.performanceReport };
    }

    importData(data) {
        if (this.isRunning || this.evaluator.running) throw new Error('진행 중에는 데이터를 불러올 수 없습니다.');
        const performance = validatePerformanceReport(data?.performance);
        // 원본(수정 없음) 측정은 비교 기준으로 받고, 지금과 다른 수정 상태의 측정은 섞지 않는다 (가중치를 바꾸기 전에 확인)
        if (performance && reportKey(performance) !== overridesKey({}) && reportKey(performance) !== overridesKey(getCardOverrides()))
            throw new Error('지금과 다른 카드 수치로 측정한 파일입니다. 같은 카드 수정 상태에서 불러와 주세요.');
        if (data?.kind === 'performance-report') {
            if (data.schemaVersion !== 1 || !data.performance) throw new Error('유효하지 않은 성능 파일입니다.');
        } else this.ai.importWeights(data);
        this._storeReport(performance);
    }

    /**
     * AI vs AI 미러매치 모드
     * 티어별로 두 AI가 각자 덱을 짜서 대결
     */
    async runMirrorMode(config) {
        if (this.isRunning || this.evaluator.running) throw new Error('이미 작업 중입니다.');
        this.isRunning = true;
        try {

        // 전역 세대 카운터 초기화 (최초 실행 시에만)
        if (typeof this.globalGen === 'undefined') {
            this.globalGen = 0;
        }

        const allResults = [];

        const tierConfigs = [
            { tier: 1, minHp: 50, maxHp: 70, label: 'T1 미러' },
            { tier: 2, minHp: 90, maxHp: 140, label: 'T1-2 미러' },
            { tier: 3, minHp: 160, maxHp: 220, label: 'T1-3 미러' },
            { tier: 4, minHp: 270, maxHp: 320, energy: 4, label: 'T1-4 미러' },
            { tier: 5, minHp: 320, maxHp: 420, energy: 4, label: 'T1-5 미러' },
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

                    // 팩 vs 팩: non-base 팩을 A/B에 랜덤 분할 (겹치지 않게)
                    const nonBasePacks = config.packs.filter(p => p !== 'base');
                    const shuffled = [...nonBasePacks].sort(() => Math.random() - 0.5);
                    // 분할 지점: 최소 1개씩 보장
                    const splitAt = Math.max(1, Math.min(
                        shuffled.length - 1,
                        Math.floor(Math.random() * shuffled.length)
                    ));
                    const packsA = ['base', ...shuffled.slice(0, splitAt)];
                    const packsB = ['base', ...shuffled.slice(splitAt)];

                    const deckA = this.ai.buildDeck(packsA, tc.tier, config.deckSize);
                    const deckB = this.ai.buildDeck(packsB, tc.tier, config.deckSize);

                    if (deckA.length < 10 || deckB.length < 10) continue;

                    // 범위 내 랜덤 체력 결정
                    const battleHp = tc.minHp + Math.floor(Math.random() * (tc.maxHp - tc.minHp + 1));

                    // 대칭 전투
                    const state = this.engine.createMirrorBattleState(deckA, deckB, { hp: battleHp, energy: tc.energy });
                    const aiStratA = (s, e, phase) => this.ai.makeDecision(s, e, phase);
                    const aiStratB = (s, e, phase) => this.ai.makeDecision(s, e, phase);
                    const result = this.engine.runMirrorBattle(state, aiStratA, aiStratB);

                    // AI A가 이기면 A의 카드에 win, B의 카드에 loss
                    const decided = result.winner === 'A' || result.winner === 'B';
                    const aOutcome = decided ? (result.winner === 'A' ? 'win' : 'lose') : 'draw';
                    const bOutcome = decided ? (result.winner === 'B' ? 'win' : 'lose') : 'draw';

                    // ─── 시너지 데이터 수집 (승리 덱의 카드 조합 추적) ───
                    const winDeck = result.winner === 'A' ? deckA : deckB;
                    const loseDeck = result.winner === 'A' ? deckB : deckA;
                    if (decided) {
                        this._trackSynergy(winDeck, true);
                        this._trackSynergy(loseDeck, false);
                    }

                    // ─── 팩 교차 분석 (덱의 팩 구성 추적) ───
                    if (decided) {
                        this._trackPackCombo(deckA, aOutcome === 'win');
                        this._trackPackCombo(deckB, bOutcome === 'win');
                    }

                    // 학습: A 사이드 사용 카드 (고티어 매치일수록 가중치 큼)
                    if (decided) this.ai.updateWeights({ cardUsageLog: result.cardUsageLogA, deck: deckA }, aOutcome, tc.tier);
                    // 학습: B 사이드 사용 카드
                    if (decided) this.ai.updateWeights({ cardUsageLog: result.cardUsageLogB, deck: deckB }, bOutcome, tc.tier);

                    // A 사이드 결과: A가 이기면 win, B가 이기면 lose
                    genResults.push({
                        side: 'A',
                        game: game + 1,
                        enemy: tc.label,
                        result: {
                            winner: decided ? (result.winner === 'A' ? 'player' : 'enemy') : 'draw',
                            turns: result.turns,
                            cardUsageLog: result.cardUsageLogA,
                            playerFinalHp: result.playerAHp,
                            enemyFinalHp: result.playerBHp
                        },
                        deckSize: deckA.length,
                        deck: deckA.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier }))
                    });
                    // B 사이드 결과: B가 이기면 win, A가 이기면 lose
                    genResults.push({
                        side: 'B',
                        game: game + 1,
                        enemy: tc.label,
                        result: {
                            winner: decided ? (result.winner === 'B' ? 'player' : 'enemy') : 'draw',
                            turns: result.turns,
                            cardUsageLog: result.cardUsageLogB,
                            playerFinalHp: result.playerBHp,
                            enemyFinalHp: result.playerAHp
                        },
                        deckSize: deckB.length,
                        deck: deckB.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier }))
                    });

                    // 전투 로그 (세대당 최대 20건 샘플링)
                    if (game < 20) {
                        this.battleLog.push({
                            gen: currentGenId,
                            game: game + 1,
                            mode: 'mirror',

                            tierMatch: tc.label,
                            winner: result.winner,
                            termination: result.termination,
                            turns: result.turns,
                            playerAHp: result.playerAHp,
                            playerBHp: result.playerBHp,
                            deckA: deckA.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier })),
                            deckB: deckB.map(c => ({ id: c.id, name: c.name, cost: c.cost, type: c.type, rarity: c.rarity, pack: c.pack, tier: c.tier })),
                            cardsUsedA: result.cardUsageLogA || [],
                            cardsUsedB: result.cardUsageLogB || [],
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
        } finally { this.isRunning = false; }
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
        const grade = value => value >= 1.5 ? 'S' : value >= 1.2 ? 'A' : value >= 0.9 ? 'B' : value >= 0.65 ? 'C' : value >= 0.45 ? 'D' : 'F';
        const report = this.activeReport(), edited = getCardOverrides();
        const ranks = rankTiers(report?.cards || {});
        // 카드를 수정했고 원본 측정이 있으면, 원본 순위를 "수정 전"으로 함께 보여 준다
        const beforeRanks = Object.keys(edited).length && this.baselineReport && report ? rankTiers(this.baselineReport.cards) : {};
        const tierList = this.ai.getCardTierList().map(card => {
            const performance = report?.cards[card.id];
            const measured = ranks[card.id], before = beforeRanks[card.id] ?? null;
            // 같은 티어에서 충분히 측정되면 티어 안 순위로 실측 등급, 아니면 학습 대전의 선택 가중치로 잠정 등급
            if (measured) return { ...card, performance, measured, before, ratio: null, valueTier: measured.grade, gradeSource: 'measured' };
            const used = card.totalUses > 0;
            const ratio = used ? Math.round(card.weight / card.selectionBaseline * 10000) / 10000 : null;
            return { ...card, performance, measured: null, before, ratio,
                valueTier: used ? grade(ratio) : '?', gradeSource: used ? 'provisional' : null };
        }).sort(byGrade);
        const comparison = Object.keys(edited).map(id => tierList.find(card => card.id === id))
            .filter(card => card?.before && card.measured)
            .map(card => ({ id: card.id, name: card.name, tier: card.tier, edits: edited[card.id], before: card.before, after: card.measured }));
        const history = this.ai.history;

        // OP/UP 경고: 빈 칸보다 확실히 나쁜 카드(UP)와 티어 상위 5%이면서 확실히 도움이 되는 카드(OP)
        const warnings = [];
        const points = value => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%p`;
        for (const card of tierList) {
            const m = card.measured;
            if (!m) continue;
            const range = `95% ${points(m.low)} ~ ${points(m.high)}`;
            if (m.up) warnings.push({ type: 'UP', card,
                message: `${card.name} — 빈 칸보다 승점 ${points(m.gain)} (${range}). 넣으면 덱이 약해져요` });
            if (m.op) warnings.push({ type: 'OP', card,
                message: `${card.name} — T${card.tier} 상위 ${Math.round(m.top * 100)}% · 빈 칸 대비 승점 ${points(m.gain)} (${range})` });
        }

        // 팩별 승률
        const packStats = {};
        for (const gen of history) {
            for (const [cardId, stats] of Object.entries(gen.cardStats || {})) {
                const pack = stats.pack || 'unknown';
                if (!packStats[pack]) packStats[pack] = { wins: 0, losses: 0, draws: 0, games: 0, uses: 0 };
                packStats[pack].wins += stats.wins;
                packStats[pack].losses += stats.losses;
                packStats[pack].uses += stats.uses;
                packStats[pack].games += stats.games;
                packStats[pack].draws += stats.draws;
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
                gradeSource: card.gradeSource,
                measured: card.measured,
                totalUses: card.totalUses || 0,
                deckInclusions: card.deckInclusions || 0,
                deckWinRate: card.deckWinRate,
                playRate: card.playRate,
                byTierMatch: card.byTierMatch || {}
            });
        }
        // 각 티어 안에서 밸류 티어와 같은 순서로 정렬
        for (const tier of Object.keys(tierHeatmap)) {
            tierHeatmap[tier].sort(byGrade);
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
            tierHeatmap,
            comparison,
            performanceReport: report,
            // 측정은 있지만 지금과 다른 카드 수치로 잰 것이라 쓰지 않은 경우
            staleMeasurement: !report && !!(this.performanceReport || this.baselineReport)
        };
    }
}
