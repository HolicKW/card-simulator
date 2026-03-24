# 🏗️ 카드 밸런스 시뮬레이터 — 아키텍처 문서

> **목적**: 학습형 AI가 카드 게임의 밸런스를 자동 평가하는 웹 시뮬레이터
> **실행**: `npx -y http-server . -p 8080` → `http://127.0.0.1:8080`

---

## 📁 파일 구조

```
card-simulator/
├── index.html          # 메인 HTML (설정 패널, 탭 UI)
├── index.css           # 전체 스타일 (다크 사이버펑크 테마)
├── ARCHITECTURE.md     # 이 문서
└── js/
    ├── cards.js        # 카드 데이터베이스 (카드풀 + 팩 레지스트리)
    ├── effects.js      # 키워드 이펙트 시스템 (오버클럭, 해체, 추출 등)
    ├── engine.js       # 전투 엔진 (턴제 전투 로직)
    ├── ai.js           # 학습형 AI (덱 빌딩 + 가중치 학습)
    ├── simulator.js    # 시뮬레이션 컨트롤러 (대규모 자동 대전)
    └── app.js          # UI 앱 (렌더링 + 이벤트 바인딩)
```

---

## 🔗 모듈 의존도

```
app.js  →  simulator.js  →  engine.js  →  effects.js
                          →  ai.js      →  cards.js
```

| 모듈 | 역할 | 주요 클래스 |
|------|------|------------|
| `cards.js` | 카드 데이터 저장소. 팩 등록/조회 API | `registerPack()`, `registerCards()`, `getAllCards()` |
| `effects.js` | 키워드별 효과 핸들러 등록 | `EffectRegistry`, `registerCoreEffects()` |
| `engine.js` | 턴제 전투 실행 엔진 | `BattleEngine` |
| `ai.js` | 학습 기반 덱 빌딩 + 의사결정 | `CardAI` |
| `simulator.js` | N판 자동 대전 + 세대별 학습 관리 | `Simulator` |
| `app.js` | 대시보드 UI 렌더링 | `App` |

---

## 📦 cards.js — 카드 데이터베이스

### 스키마
```javascript
{
  id: 'OC_006',           // 고유 ID (팩접두사_번호)
  name: '피를 머금은 톱니', // 카드 이름
  pack: 'overclock',       // 소속 팩 ID
  type: 'attack',          // attack | skill | power
  rarity: 'common',        // common | uncommon | rare | epic | unique | legendary
  tier: 1,                 // 해금 티어 (1~5)
  cost: 1,                 // 에너지 코스트
  keywords: ['overclock'],  // 키워드 태그
  effects: [...],           // 이펙트 배열
  description: '...'        // 설명 텍스트
}
```

### 등록된 팩
| 팩 ID | 이름 | 카드 수 |
|-------|------|---------|
| `base` | 기본 공용 카드 | 26장 |
| `overclock` | 오버클럭 코어 팩 | 45장 |
| `dismantle` | 해체/재구축 팩 | 45장 |

### 새 팩 추가
```javascript
registerPack('newpack', { name: '새 팩', description: '...', totalCards: 45 });
registerCards([ /* 카드 객체 배열 */ ]);
```

---

## ⚡ effects.js — 이펙트 시스템

플러그인 패턴으로 키워드별 효과 핸들러를 등록.

### 지원 이펙트 타입
| 타입 | 설명 |
|------|------|
| `damage` | 대상에게 피해 (힘 적용) |
| `multiHit` | 다중 타격 |
| `shield` | 방어도 획득 |
| `shieldBreak` | 적 방어도 감소 |
| `heal` | 체력 회복 |
| `selfDamage` | 자해 |
| `draw` | 카드 드로우 |
| `energy` | 에너지 획득 |
| `strength` | 힘 버프 |
| `weak` | 약화 디버프 |
| `overload` | 과부하 (다음 턴 에너지 감소) |
| `overclock` | 오버클럭 스택 증가 |
| `overclockReduce` | 오버클럭 스택 감소 |
| `dismantle` | 해체 (카드 영구 소멸) |
| `rebuild` | 재구축 (해체 후 재사용) |
| `extract` | 추출 (해체 시 보너스 효과) |
| `conditional` | 조건부 효과 (체력 조건 등) |

### 새 이펙트 추가
```javascript
registry.register('newKeyword', (ctx) => {
  // ctx.state, ctx.caster, ctx.target, ctx.card, ctx.effect, ctx.engine
});
```

---

## ⚔️ engine.js — 전투 엔진 (809줄)

### 전투 흐름 (PvE)
```
createBattleState() → runFullBattle()
  ├─ 멀리건 (_doMulligan)
  └─ 루프 (최대 50턴):
      ├─ 턴 시작: 에너지 리셋, 드로우 5장, 파워 발동
      ├─ 플레이어 턴 (_playerTurn): AI가 카드 선택 → playCard()
      ├─ 적 턴 (_enemyTurn): 패턴 기반 공격/방어
      └─ 승패 판정
```

### 전투 흐름 (AI vs AI 미러매치)
```
createMirrorBattleState() → runMirrorBattle()
  ├─ 양쪽 멀리건 (_doMirrorMulligan)
  └─ 루프 (최대 50턴):
      ├─ A 턴: 에너지·드로우 → AI A가 카드 플레이
      ├─ B 턴: 에너지·드로우 → AI B가 카드 플레이
      ├─ 턴별 로그 기록 (카드명, 피해량, HP 변화)
      └─ 승패 판정
```

### 주요 메서드
| 메서드 | 설명 |
|--------|------|
| `createBattleState(deck, enemy)` | PvE 전투 상태 생성 |
| `runFullBattle(state, ai)` | PvE 전투 자동 실행 |
| `createMirrorBattleState(deckA, deckB)` | 미러매치 상태 생성 |
| `runMirrorBattle(state, aiA, aiB)` | 미러매치 자동 실행 + 턴 로그 |
| `playCard(state, index)` | 카드 사용 (효과 적용) |
| `applyDamage(target, amount)` | 피해 계산 (방어도 → 체력) |
| `dismantleCard(entity)` | 카드 해체 (보이드로 소멸) |

---

## 🧠 ai.js — 학습형 AI (453줄)

### 핵심 개념

**티어 Baseline 시스템**: 각 티어별 기대 가중치를 설정하고, 실전 성과 대비 편차로 카드를 평가.

```javascript
TIER_BASELINES = { 1: 1.0, 2: 1.5, 3: 2.2, 4: 3.2, 5: 4.5 }
RARITY_MULTIPLIER = { common: 0.8, rare: 1.0, epic: 1.3, unique: 1.6, legendary: 2.0 }
```

### 덱 빌딩 (`buildDeck`)
1. **탐색 보장**: 누적 사용 10회 미만 카드를 덱 절반에 강제 투입 (모든 카드 최소 10회 사용 보장)
2. **희귀도 배수**: 커먼 ×5, 레어 x 4, 에픽 ×3, 유니크 ×2,레전더리 ×1 → 커먼 중복 넣기 쉬움
3. **가중치 선택**: sigmoid(가중치 - baseline) 확률로 나머지 슬롯 채움
4. **Power 제한**: 동일 power 카드 1장만

### 학습 사이클
```
전투 결과 → updateWeights() → endGeneration()
  ├─ 카드별 승률 계산
  ├─ 티어 그룹 내 상대 순위 ELO 조정
  ├─ 누적 통계(cumulativeStats) 업데이트
  └─ 밸류 티어 판정 (S/A/B/C/D/F/?)
```

### 밸류 티어 기준
| 등급 | Baseline 대비 비율 | 의미 |
|------|-------------------|------|
| S | ≥ 150% | 해당 티어 내 사기급 |
| A | ≥ 120% | 강력 |
| B | ≥ 90% | 적정 |
| C | ≥ 65% | 약간 부족 |
| D | ≥ 45% | 약체 |
| F | < 45% | 사용 가치 없음 |
| ? | 사용 0회 | 미평가 |

---

## 🔄 simulator.js — 시뮬레이션 컨트롤러 (367줄)

### 두 가지 모드

#### 1. PvE 모드 (`run()`)
- AI가 덱을 빌드 → 패턴 기반 적과 대결
- 적 설정: 티어별 HP + 고정 공격 패턴
- 세대당 N판 반복 → 학습 → 다음 세대

#### 2. AI vs AI 미러매치 (`runMirrorMode()`)
- 두 AI가 각자 덱 빌드 → 대칭 전투
- 티어별 매칭: T1, T1-2, T1-3, T1-4, T1-5
- 양쪽 모두 학습 (승자 카드 +, 패자 카드 -)

### 전투 로그
- **세대당 최대 20건** 샘플링 저장
- **최신 10세대분만** 유지 (오래된 것 자동 제거)
- PvE: 덱 구성 + 사용 카드
- 미러: 양쪽 덱 + 턴별 상세 로그 (카드명, 피해, HP 변화)

### 설정값 (config)
```javascript
{
  gamesPerGeneration: 100,  // 세대당 게임 수
  generations: 10,           // 학습 세대 수
  deckSize: 20,              // 덱 크기 (10~40)
  tierLimit: 5,              // 티어 제한 (1~5)
  packs: ['base', ...]       // 사용할 팩 목록
}
```

---

## 🖥️ app.js — 대시보드 UI (608줄)

### 탭 구조
| 탭 | 내용 | 렌더 메서드 |
|----|------|------------|
| 🏆 밸류 티어 리스트 | S~F+? 등급별 카드 목록 | `_renderTierList()` |
| ⚠️ 밸런스 경고 | OP/UP 카드 감지 | `_renderWarnings()` |
| 📊 팩별 통계 | 팩별 승률/사용율 | `_renderPackStats()` |
| 📈 학습 그래프 | 세대별 승률/카드수 추이 | `_renderLearningGraph()` |
| ⚔️ 전투 로그 | 전투별 상세 정보 (아코디언) | `_renderBattleLog()` |
| 🃏 카드 풀 | 등록된 전체 카드 목록 | `_renderCardPool()` |

### 전투 로그 렌더링
- **PvE**: `_renderPveEntry()` — 덱 + 사용 카드
- **미러매치**: `_renderMirrorEntry()` — 🔵A vs 🔴B 양쪽 덱 + 턴별 로그

### 데이터 내보내기/불러오기
- `_exportData()` → JSON 다운로드 (가중치, 통계, 학습 이력)
- `_importData()` → JSON 업로드로 학습 상태 복원

---

## 🔧 확장 가이드

### 새 카드팩 추가
1. `cards.js`에 `registerPack()` + `registerCards()` 호출
2. 끝. UI에 자동 반영.

### 새 키워드/이펙트 추가
1. `effects.js`의 `registerCoreEffects()` 안에 `registry.register()` 추가
2. `engine.js`의 `playCard()`에서 해당 키워드 처리 (필요 시)

### 새 시뮬레이션 모드 추가
1. `simulator.js`에 새 메서드 추가 (e.g., `runTournament()`)
2. `app.js`의 `_startSimulation()`에 모드 분기 추가
3. `index.html`의 `#sim-mode` 셀렉트에 옵션 추가
