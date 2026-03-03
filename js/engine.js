/**
 * engine.js — 전투 시뮬레이션 엔진
 * 
 * 게임 규칙을 충실히 구현한 턴제 전투 엔진.
 * - 덱, 핸드, 보이드(소멸) 영역
 * - 멀리건 → 드로우 → 행동 → 적 턴 사이클
 * - 소멸 무덤, 방어도 영구 유지, 힘/약화 등
 */

import { EffectRegistry, registerCoreEffects } from './effects.js';

export class BattleEngine {
    constructor() {
        this.effectRegistry = new EffectRegistry();
        registerCoreEffects(this.effectRegistry);
        this.battleLog = [];
    }

    /**
     * 새 전투 상태 생성
     * @param {Object[]} playerDeck - 플레이어 덱 (카드 배열, 깊은 복사됨)
     * @param {Object} enemyConfig - 적 설정 { hp, maxHp, attackPattern }
     * @returns {BattleState}
     */
    createBattleState(playerDeck, enemyConfig) {
        return {
            player: {
                hp: enemyConfig.playerHp || 50,
                maxHp: enemyConfig.playerHp || 50,
                shield: 0,
                energy: 3,
                baseEnergy: 3,
                strength: 0,
                weakness: 0,
                overclockStacks: 0,
                overclockMax: 4,
                overloadNext: 0,
                selfDamageThisTurn: 0,
                dismantledThisTurn: 0,
                dismantledThisBattle: 0,
                cardsPlayedThisTurn: 0,
                drawPile: this._shuffleArray(playerDeck.map(c => this._cloneCard(c))),
                hand: [],
                void: [],
                activePowers: [],
                baseDraw: 5,
                extraDraw: 0,
                rebuildBonuses: 0,
                totalRebuildsThisBattle: 0
            },
            enemy: {
                hp: enemyConfig.hp || 100,
                maxHp: enemyConfig.hp || 100,
                shield: 0,
                strength: 0,
                weakness: 0,
                attackPattern: enemyConfig.attackPattern || [
                    { type: 'attack', damage: 8 },
                    { type: 'attack', damage: 12 },
                    { type: 'defend', shield: 10 },
                    { type: 'attack', damage: 15 },
                    { type: 'buff', strength: 2 }
                ],
                patternIndex: 0
            },
            turn: 0,
            phase: 'start',
            winner: null,
            // 카드 사용 기록 (학습용)
            cardUsageLog: [],
            turnLog: []
        };
    }

    /**
     * 전투 전체를 자동 실행 (시뮬레이션용)
     * @param {BattleState} state 
     * @param {Function} aiStrategy - (state, engine) => 카드 사용 결정
     * @param {number} maxTurns - 최대 턴 수 (무한루프 방지)
     * @returns {BattleResult}
     */
    runFullBattle(state, aiStrategy, maxTurns = 50) {
        // 초기 드로우 5장
        this._drawCards(state.player, 5);
        // 멀리건 (AI가 결정)
        this._doMulligan(state, aiStrategy);

        while (!state.winner && state.turn < maxTurns) {
            state.turn++;
            this._playerTurn(state, aiStrategy);
            if (state.winner) break;
            this._enemyTurn(state);
            if (state.winner) break;
        }

        if (!state.winner) {
            // 턴 초과 시 남은 체력 비율로 판정
            const pRatio = state.player.hp / state.player.maxHp;
            const eRatio = state.enemy.hp / state.enemy.maxHp;
            state.winner = pRatio >= eRatio ? 'player' : 'enemy';
        }

        return {
            winner: state.winner,
            turns: state.turn,
            playerHp: state.player.hp,
            enemyHp: state.enemy.hp,
            cardUsageLog: state.cardUsageLog,
            cardsInVoid: state.player.void.length
        };
    }

    // ─── 턴 진행 ───

    _playerTurn(state, aiStrategy) {
        const p = state.player;

        // 턴 시작 초기화
        p.energy = p.baseEnergy - (p.overloadNext || 0);
        if (p.energy < 0) p.energy = 0;
        p.overloadNext = 0;
        p.selfDamageThisTurn = 0;
        p.dismantledThisTurn = 0;
        p.cardsPlayedThisTurn = 0;

        // 힘 반감 (턴 시작 시)
        p.strength = Math.floor(p.strength / 2);

        // 약화 자연 치유 (적의 약화가 플레이어에게 건 것)
        // 현재는 플레이어 약화는 턴 시작 시 1 감소
        if (p.weakness > 0) p.weakness -= 1;

        // 드로우 페이즈: 핸드가 5장 미만이면 보충
        const drawTarget = p.baseDraw + p.extraDraw;
        const toDraw = Math.max(0, drawTarget - p.hand.length);
        this._drawCards(p, toDraw);

        // 파워 효과 (턴 시작 시)
        this._applyPowerEffects(state, 'turnStart');

        // 오버클럭 스택 자동 감소 (턴 시작 시 1 감소)
        if (p.overclockStacks > 0) {
            p.overclockStacks--;
        }

        // AI 행동 페이즈
        let actions = 0;
        const maxActions = 20; // 무한루프 방지
        while (actions < maxActions && !state.winner) {
            const decision = aiStrategy(state, this);
            if (!decision || decision.action === 'end_turn') break;

            if (decision.action === 'play_card') {
                const cardIndex = decision.cardIndex;
                if (cardIndex >= 0 && cardIndex < p.hand.length) {
                    const card = p.hand[cardIndex];
                    if (card && p.energy >= card.cost) {
                        this.playCard(state, cardIndex);
                    } else {
                        break; // 코스트 부족
                    }
                } else {
                    break;
                }
            }
            actions++;
        }

        // 파워 효과 (턴 종료 시)
        this._applyPowerEffects(state, 'turnEnd');

        // 한계 돌파 훈련 체크
        this._checkPowerTriggers(state, 'turnEnd');
    }

    _enemyTurn(state) {
        const e = state.enemy;
        const pattern = e.attackPattern[e.patternIndex % e.attackPattern.length];

        // 적 약화 감소 (턴 시작)
        if (e.weakness > 0) e.weakness -= 1;

        switch (pattern.type) {
            case 'attack': {
                let dmg = pattern.damage + (e.strength || 0);
                dmg -= (state.player.weakness || 0);
                if (dmg < 1) dmg = 1;
                this.applyDamage(state.player, dmg);
                break;
            }
            case 'defend':
                e.shield = (e.shield || 0) + pattern.shield;
                break;
            case 'buff':
                e.strength = (e.strength || 0) + (pattern.strength || 0);
                break;
            case 'multiAttack': {
                const hits = pattern.hits || 2;
                let dmg = pattern.damage + (e.strength || 0);
                dmg -= (state.player.weakness || 0);
                if (dmg < 1) dmg = 1;
                for (let i = 0; i < hits; i++) {
                    this.applyDamage(state.player, dmg);
                    if (state.player.hp <= 0) break;
                }
                break;
            }
        }

        e.patternIndex++;

        // 승패 체크
        if (state.player.hp <= 0) {
            // 불멸의 사이보그 체크
            const revive = state.player.activePowers.find(p => p.powerEffect?.type === 'reviveOnce' && !p._revived);
            if (revive) {
                revive._revived = true;
                state.player.hp = Math.floor(state.player.maxHp * (revive.powerEffect.value / 100));
            } else {
                state.winner = 'enemy';
            }
        }
    }

    // ─── 카드 플레이 ───

    playCard(state, cardIndex) {
        const p = state.player;
        const card = p.hand[cardIndex];
        if (!card) return;

        // 코스트 차감
        p.energy -= card.cost;
        p.cardsPlayedThisTurn++;

        // 오버클럭 카드이면 스택 증가
        if (card.keywords && card.keywords.includes('overclock')) {
            p.overclockStacks = Math.min(
                (p.overclockStacks || 0) + 1,
                p.overclockMax
            );
        }

        // 핸드에서 제거
        p.hand.splice(cardIndex, 1);

        // 이펙트 실행
        const ctx = {
            state,
            caster: p,
            target: state.enemy,
            card,
            engine: this
        };

        for (const effect of card.effects) {
            ctx.effect = effect;
            this.effectRegistry.execute(effect.type, ctx);
        }

        // 파워 카드 처리
        if (card.type === 'power') {
            p.activePowers.push(this._cloneCard(card));
            // 파워 즉시 효과 적용
            if (card.powerEffect) {
                this._applyImmediatePowerEffect(state, card.powerEffect);
            }
        }

        // 사용 기록
        state.cardUsageLog.push({
            turn: state.turn,
            cardId: card.id,
            cardName: card.name,
            pack: card.pack,
            rarity: card.rarity,
            playerHpAfter: p.hp,
            enemyHpAfter: state.enemy.hp
        });

        // 재구축 처리
        if (card.keywords && card.keywords.includes('rebuild') && card.rebuildCount > 0) {
            const rebuiltCard = this._cloneCard(card);
            rebuiltCard.rebuildCount--;
            // 재구축 보너스
            rebuiltCard.rebuildCount += p.rebuildBonuses || 0;
            if (rebuiltCard.rebuildCount > 0) {
                p.hand.push(rebuiltCard);
                p.totalRebuildsThisBattle++;
            } else {
                p.void.push(card);
            }
        } else if (card.type !== 'power') {
            // 일반 카드는 보이드로
            p.void.push(card);
        }

        // 파워 트리거 체크
        this._checkPowerTriggers(state, 'cardPlayed', card);

        // 승패 체크
        if (state.enemy.hp <= 0) {
            state.winner = 'player';
        }
        if (p.hp <= 0) {
            const revive = p.activePowers.find(pw => pw.powerEffect?.type === 'reviveOnce' && !pw._revived);
            if (revive) {
                revive._revived = true;
                p.hp = Math.floor(p.maxHp * (revive.powerEffect.value / 100));
            } else {
                state.winner = 'enemy';
            }
        }
    }

    // ─── 유틸리티 메서드 ───

    applyDamage(target, amount) {
        if (amount <= 0) return;
        if (target.shield > 0) {
            if (target.shield >= amount) {
                target.shield -= amount;
                return;
            } else {
                amount -= target.shield;
                target.shield = 0;
            }
        }
        target.hp -= amount;
        if (target.hp < 0) target.hp = 0;
    }

    drawCard(entity) {
        this._drawCards(entity, 1);
    }

    dismantleCard(entity, random = true) {
        if (entity.hand.length === 0) return;

        let idx;
        if (random) {
            idx = Math.floor(Math.random() * entity.hand.length);
        } else {
            // AI에서는 가장 낮은 밸류 카드를 해체 (간단한 휴리스틱)
            idx = this._findLowestValueCard(entity.hand);
        }

        const card = entity.hand.splice(idx, 1)[0];
        if (!card) return;

        // 추출 트리거
        if (card.keywords && card.keywords.includes('extract') && card.extractEffects) {
            const ctx = {
                state: null, // 컨텍스트는 간략화
                caster: entity,
                target: entity._opponent || entity,
                card,
                engine: this
            };
            for (const effect of card.extractEffects) {
                ctx.effect = effect;
                this.effectRegistry.execute(effect.type, ctx);
            }
        }

        entity.void = entity.void || [];
        entity.void.push(card);
        entity.dismantledThisTurn = (entity.dismantledThisTurn || 0) + 1;
        entity.dismantledThisBattle = (entity.dismantledThisBattle || 0) + 1;
    }

    _drawCards(entity, count) {
        const maxHand = 10;
        for (let i = 0; i < count; i++) {
            if (entity.hand.length >= maxHand) break;
            if (entity.drawPile.length === 0) break;
            entity.hand.push(entity.drawPile.shift());
        }
    }

    _doMulligan(state, aiStrategy) {
        // AI가 멀리건할 카드 인덱스 결정
        const mulliganIndices = aiStrategy(state, this, 'mulligan');
        if (!mulliganIndices || mulliganIndices.length === 0) return;

        const p = state.player;
        const temp = [];
        // 선택된 카드를 임시 영역으로
        const sortedIndices = [...mulliganIndices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < p.hand.length) {
                temp.push(p.hand.splice(idx, 1)[0]);
            }
        }
        // 새 카드 먼저 드로우
        this._drawCards(p, temp.length);
        // 버린 카드를 덱에 반환
        p.drawPile.push(...temp);
        // 셔플
        this._shuffleArray(p.drawPile);
    }

    _applyPowerEffects(state, timing) {
        const p = state.player;
        for (const power of p.activePowers) {
            if (!power.powerEffect) continue;
            const pe = power.powerEffect;

            if (timing === 'turnStart') {
                switch (pe.type) {
                    case 'extraDraw':
                        // 이미 baseDraw + extraDraw로 반영
                        break;
                    case 'extraEnergy':
                        p.energy += pe.value;
                        break;
                    case 'overclockPerTurn':
                        p.energy = Math.max(0, p.energy - (pe.energyCost || 0));
                        p.overclockStacks = Math.min(
                            p.overclockStacks + pe.value,
                            p.overclockMax
                        );
                        break;
                }
            }

            if (timing === 'turnEnd') {
                switch (pe.type) {
                    case 'healOnHighOverclock':
                        if (p.overclockStacks >= pe.threshold) {
                            p.overclockStacks--;
                            p.hp = Math.min(p.hp + pe.value, p.maxHp);
                        }
                        break;
                }
            }
        }
    }

    _applyImmediatePowerEffect(state, pe) {
        const p = state.player;
        switch (pe.type) {
            case 'extraDraw':
                p.extraDraw += pe.value;
                break;
            case 'extraEnergy':
                p.baseEnergy += pe.value;
                break;
            case 'rebuildBonus':
                p.rebuildBonuses += pe.value;
                break;
        }
    }

    _checkPowerTriggers(state, event, card) {
        const p = state.player;
        for (const power of p.activePowers) {
            if (!power.powerEffect) continue;
            const pe = power.powerEffect;

            if (event === 'turnEnd') {
                if (pe.type === 'strengthOnManyCards' && p.cardsPlayedThisTurn >= pe.threshold) {
                    p.strength += pe.value;
                }
            }

            if (event === 'cardPlayed' && card) {
                if (pe.type === 'shieldOnOverclock' && card.keywords?.includes('overclock')) {
                    pe._triggeredThisTurn = (pe._triggeredThisTurn || 0) + 1;
                    if (pe._triggeredThisTurn <= (pe.maxPerTurn || 5)) {
                        p.shield += pe.value;
                    }
                }
                if (pe.type === 'damageOnSelfDamage' && p.selfDamageThisTurn > 0) {
                    this.applyDamage(state.enemy, p.selfDamageThisTurn);
                }
                if (pe.type === 'damageOnDismantle' && p.dismantledThisTurn > 0) {
                    this.applyDamage(state.enemy, pe.value);
                }
            }
        }
    }

    _findLowestValueCard(hand) {
        let minIdx = 0;
        let minVal = Infinity;
        hand.forEach((card, i) => {
            // 간단한 밸류 추정: 코스트가 낮을수록, 기본 공격/스킬일수록 해체 대상
            const val = card.cost + (card.rarity === 'common' ? 0 : card.rarity === 'rare' ? 1 : 2);
            if (val < minVal) {
                minVal = val;
                minIdx = i;
            }
        });
        return minIdx;
    }

    _cloneCard(card) {
        return JSON.parse(JSON.stringify(card));
    }

    _shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ═══════════════════════════════════════════
    //  AI vs AI 대칭 전투 (미러매치)
    // ═══════════════════════════════════════════

    /**
     * 대칭 전투 상태 생성
     * @param {Object[]} deckA - 좌 AI 덱
     * @param {Object[]} deckB - 우 AI 덱
     * @param {Object} config - { hp, maxHp }
     */
    createMirrorBattleState(deckA, deckB, config = {}) {
        const hp = config.hp || 80;
        const makePlayer = (deck) => ({
            hp, maxHp: hp,
            shield: 0, energy: 3, baseEnergy: 3,
            strength: 0, weakness: 0,
            overclockStacks: 0, overclockMax: 4,
            overloadNext: 0, selfDamageThisTurn: 0,
            dismantledThisTurn: 0, dismantledThisBattle: 0,
            cardsPlayedThisTurn: 0,
            drawPile: this._shuffleArray(deck.map(c => this._cloneCard(c))),
            hand: [], void: [], activePowers: [],
            baseDraw: 5, extraDraw: 0,
            rebuildBonuses: 0, totalRebuildsThisBattle: 0
        });

        const playerA = makePlayer(deckA);
        const playerB = makePlayer(deckB);
        playerA._opponent = playerB;
        playerB._opponent = playerA;

        return {
            playerA, playerB,
            turn: 0, phase: 'start', winner: null,
            cardUsageLogA: [], cardUsageLogB: [],
            turnLog: [] // 턴별 상세 기록
        };
    }

    /**
     * 대칭 전투 실행 (AI vs AI)
     * 턴별 상세 로그 포함
     */
    runMirrorBattle(state, aiStrategyA, aiStrategyB, maxTurns = 50) {
        // 초기 드로우
        this._drawCards(state.playerA, 5);
        this._drawCards(state.playerB, 5);

        // 멀리건
        this._doMirrorMulligan(state, 'A', aiStrategyA);
        this._doMirrorMulligan(state, 'B', aiStrategyB);

        // 선공 랜덤
        const firstSide = Math.random() < 0.5 ? 'A' : 'B';

        while (!state.winner && state.turn < maxTurns) {
            state.turn++;
            const turnEntry = {
                turn: state.turn,
                actions: [],
                hpAfter: {}
            };

            if (firstSide === 'A') {
                this._mirrorPlayerTurn(state, 'A', aiStrategyA, turnEntry);
                if (!state.winner) this._mirrorPlayerTurn(state, 'B', aiStrategyB, turnEntry);
            } else {
                this._mirrorPlayerTurn(state, 'B', aiStrategyB, turnEntry);
                if (!state.winner) this._mirrorPlayerTurn(state, 'A', aiStrategyA, turnEntry);
            }

            turnEntry.hpAfter = {
                A: { hp: state.playerA.hp, shield: state.playerA.shield },
                B: { hp: state.playerB.hp, shield: state.playerB.shield }
            };
            state.turnLog.push(turnEntry);

            if (state.winner) break;
        }

        if (!state.winner) {
            const rA = state.playerA.hp / state.playerA.maxHp;
            const rB = state.playerB.hp / state.playerB.maxHp;
            state.winner = rA >= rB ? 'A' : 'B';
        }

        return {
            winner: state.winner,
            turns: state.turn,
            playerAHp: state.playerA.hp,
            playerBHp: state.playerB.hp,
            cardUsageLogA: state.cardUsageLogA,
            cardUsageLogB: state.cardUsageLogB,
            turnLog: state.turnLog
        };
    }

    _doMirrorMulligan(state, side, aiStrategy) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;

        const fakeState = {
            player, enemy: opponent,
            turn: 0, phase: 'mulligan'
        };

        const indices = aiStrategy(fakeState, this, 'mulligan');
        if (!indices || indices.length === 0) return;

        const temp = [];
        const sorted = [...indices].sort((a, b) => b - a);
        for (const idx of sorted) {
            if (idx >= 0 && idx < player.hand.length) {
                temp.push(player.hand.splice(idx, 1)[0]);
            }
        }
        this._drawCards(player, temp.length);
        player.drawPile.push(...temp);
        this._shuffleArray(player.drawPile);
    }

    _mirrorPlayerTurn(state, side, aiStrategy, turnEntry) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;
        const usageLog = side === 'A' ? state.cardUsageLogA : state.cardUsageLogB;

        // 턴 시작 초기화
        player.energy = player.baseEnergy - (player.overloadNext || 0);
        if (player.energy < 0) player.energy = 0;
        player.overloadNext = 0;
        player.selfDamageThisTurn = 0;
        player.dismantledThisTurn = 0;
        player.cardsPlayedThisTurn = 0;
        player.strength = Math.floor(player.strength / 2);
        if (player.weakness > 0) player.weakness -= 1;

        // 드로우
        const drawTarget = player.baseDraw + player.extraDraw;
        const toDraw = Math.max(0, drawTarget - player.hand.length);
        this._drawCards(player, toDraw);

        // 파워 효과 (턴 시작)
        this._applyMirrorPowerEffects(player, 'turnStart');

        // 오버클럭 감소
        if (player.overclockStacks > 0) player.overclockStacks--;

        // AI 행동
        const fakeState = {
            player, enemy: opponent,
            turn: state.turn, phase: 'action'
        };

        let actions = 0;
        while (actions < 20 && !state.winner) {
            const decision = aiStrategy(fakeState, this);
            if (!decision || decision.action === 'end_turn') break;

            if (decision.action === 'play_card') {
                const ci = decision.cardIndex;
                if (ci >= 0 && ci < player.hand.length) {
                    const card = player.hand[ci];
                    if (card && player.energy >= card.cost) {
                        const oppHpBefore = opponent.hp;
                        const oppShieldBefore = opponent.shield;
                        const playerHpBefore = player.hp;

                        this._mirrorPlayCard(state, side, ci, usageLog);

                        // 턴 로그에 행동 기록
                        turnEntry.actions.push({
                            side,
                            cardName: card.name,
                            cardId: card.id,
                            cardCost: card.cost,
                            cardType: card.type,
                            damageDone: Math.max(0, oppHpBefore - opponent.hp) + Math.max(0, oppShieldBefore - opponent.shield),
                            selfHpChange: player.hp - playerHpBefore,
                            shieldGained: Math.max(0, player.shield - (playerHpBefore === player.hp ? 0 : 0)), // 간략화
                            oppHpAfter: opponent.hp,
                            playerHpAfter: player.hp
                        });
                    } else break;
                } else break;
            }
            actions++;
        }

        // 파워 효과 (턴 종료)
        this._applyMirrorPowerEffects(player, 'turnEnd');
    }

    _mirrorPlayCard(state, side, cardIndex, usageLog) {
        const player = side === 'A' ? state.playerA : state.playerB;
        const opponent = side === 'A' ? state.playerB : state.playerA;
        const card = player.hand[cardIndex];
        if (!card) return;

        player.energy -= card.cost;
        player.cardsPlayedThisTurn++;

        if (card.keywords?.includes('overclock')) {
            player.overclockStacks = Math.min(
                (player.overclockStacks || 0) + 1,
                player.overclockMax
            );
        }

        player.hand.splice(cardIndex, 1);

        const ctx = {
            state: {
                player, enemy: opponent, turn: state.turn, phase: 'action',
                cardUsageLog: usageLog, turnLog: state.turnLog
            },
            caster: player,
            target: opponent,
            card,
            engine: this
        };

        for (const effect of card.effects) {
            ctx.effect = effect;
            this.effectRegistry.execute(effect.type, ctx);
        }

        if (card.type === 'power') {
            player.activePowers.push(this._cloneCard(card));
            if (card.powerEffect) {
                this._applyMirrorImmediatePower(player, card.powerEffect);
            }
        }

        usageLog.push({
            turn: state.turn,
            cardId: card.id,
            cardName: card.name,
            pack: card.pack,
            rarity: card.rarity,
            playerHpAfter: player.hp,
            enemyHpAfter: opponent.hp
        });

        // 재구축
        if (card.keywords?.includes('rebuild') && card.rebuildCount > 0) {
            const rebuilt = this._cloneCard(card);
            rebuilt.rebuildCount--;
            rebuilt.rebuildCount += player.rebuildBonuses || 0;
            if (rebuilt.rebuildCount > 0) {
                player.hand.push(rebuilt);
                player.totalRebuildsThisBattle++;
            } else {
                player.void.push(card);
            }
        } else if (card.type !== 'power') {
            player.void.push(card);
        }

        // 승패 체크
        if (opponent.hp <= 0) {
            state.winner = side;
        }
        if (player.hp <= 0) {
            const revive = player.activePowers.find(pw => pw.powerEffect?.type === 'reviveOnce' && !pw._revived);
            if (revive) {
                revive._revived = true;
                player.hp = Math.floor(player.maxHp * (revive.powerEffect.value / 100));
            } else {
                state.winner = side === 'A' ? 'B' : 'A';
            }
        }
    }

    _applyMirrorPowerEffects(player, timing) {
        for (const power of player.activePowers) {
            if (!power.powerEffect) continue;
            const pe = power.powerEffect;
            if (timing === 'turnStart') {
                if (pe.type === 'extraEnergy') player.energy += pe.value;
                if (pe.type === 'overclockPerTurn') {
                    player.energy = Math.max(0, player.energy - (pe.energyCost || 0));
                    player.overclockStacks = Math.min(player.overclockStacks + pe.value, player.overclockMax);
                }
            }
            if (timing === 'turnEnd') {
                if (pe.type === 'healOnHighOverclock' && player.overclockStacks >= pe.threshold) {
                    player.overclockStacks--;
                    player.hp = Math.min(player.hp + pe.value, player.maxHp);
                }
            }
        }
    }

    _applyMirrorImmediatePower(player, pe) {
        if (pe.type === 'extraDraw') player.extraDraw += pe.value;
        if (pe.type === 'extraEnergy') player.baseEnergy += pe.value;
        if (pe.type === 'rebuildBonus') player.rebuildBonuses += pe.value;
    }
}
