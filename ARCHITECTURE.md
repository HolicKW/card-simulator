# 카드 시뮬레이터 아키텍처

## 데이터와 모듈

```text
NewWorld/Assets/Resources/{cards,specialCards}.json
  → scripts/sync-newworld.mjs
  → js/data/*.json + js/newworld-cards.js
  → js/cards.js

app.js → simulator.js → engine.js → effects.js → effects-bio-gamble.js
                     → ai.js                  → battle-rules.js
                       engine.js → core-effects.js → effects-bio-gamble.js
```

| 파일 | 역할 |
|---|---|
| `js/data/*.json` | NewWorld 원본 데이터 스냅샷 |
| `js/newworld-cards.js` | 브라우저에서 정적으로 import하는 생성 데이터 |
| `js/cards.js` | 기존 조회 API, 팩 목록, 표시용 type/rarity/name/description 변환 |
| `js/battle-rules.js` | Unity 반올림, 키워드 조회, 명시적 카드 복제 |
| `js/effects.js` | native CardEffect 핸들러 레지스트리와 실행 |
| `js/effects-bio-gamble.js` | 바이러스 소모, 도박 판정/재판정/보험 |
| `js/core-effects.js` | 설치 코어, 이벤트별 코어 트리거 |
| `js/engine.js` | 상태, 카드 사용, 피해, 덱/해체/재구축, 턴과 승패 |
| `js/ai.js` | 덱 구성, 합법 카드 선택, 가중치/통계 |
| `js/simulator.js` | 세대별 대전 실행, 결과 집계, 학습 |
| `js/app.js` | 설정과 결과 대시보드 |
| `tests/*.test.mjs` | Node assert 기반 회귀 테스트 |

## 데이터 계약

일반 카드 245장과 특수 카드 2장을 동기화합니다. 팩은 `base`, `overclock`, `dismantle`, `network`, `biohazard`, `russian_roulette`, `IP`입니다. `getAllCards()`는 일반 카드만 반환하고 `getSpecialCardById()`로 발버둥/랜섬웨어를 조회합니다.

`CardData`, `CardEffect`, `CoreEffect`, `dynamicCost`, `scaledCost` 필드는 C# 데이터 그대로 유지합니다. 기존 UI 호환을 위해 `Core`를 `power`로 표시하지만 효과는 `coreEffect`를 사용합니다. `powerEffect`, `costScaling`, `playCondition` 등 과거 별도 스키마로 변환하지 않습니다. `rawDescription`은 원문이며 `description`은 정적 UI 표시용 치환 결과입니다.

수치를 수정할 때 NewWorld 원본을 고친 뒤 동기화합니다. 별도 기획서가 있는 경우에도 원본/스냅샷과 함께 맞춥니다. 생성 모듈만 고치면 다음 동기화에서 사라집니다.

## 실제 전투 경로

`Simulator`는 `createMirrorBattleState()`와 `runMirrorBattle()`을 사용합니다. 양쪽 멀리건 이후 각 턴은 `_mirrorPlayerTurn()`을 통해 실행합니다. `_mirrorPlayCard()`와 호환용 `playCard()`는 같은 카드 실행 규칙을 사용합니다.

카드 선택 가능 여부는 `engine.canPlayCard(entity,index)`, 실제 소모량은 `engine.getEffectiveCost(card,entity)`가 결정합니다. AI가 사용 조건/비용을 따로 구현하지 않습니다.

카드 사용은 비용/카운터 → 기존 스택 기준 컨텍스트 → 프로토콜 → 본 효과 → 스택 증가 → 축적/코어 → 마지막 카드 기록 → 설치/재구축/보이드 → 승패 순서입니다. `protocolOverride`는 성공한 프로토콜이 기본 효과를 대체합니다. 재구축은 같은 카드 인스턴스의 횟수를 줄여 손으로 되돌립니다.

`entity.turn`에는 한 턴 동안만 유효한 카운터/버프를 보관합니다. 네트워크 스택, 이전 카드, 프로토콜 바이패스, 설치 코어 등 전투 지속 상태와 분리합니다. 덱 영역은 `drawPile`, `hand`, `voidPile`, `activeCores`입니다.

일반 피해는 무적/회피/감소/긴급 회피/실드/반격/사망을 처리합니다. 직접 HP 차감과 일반 피해를 구분하며, 전투가 끝나면 다음 효과 실행을 중단합니다. 반올림은 `Mathf.RoundToInt`의 반올림(.5에서 짝수)을 따릅니다.

턴 시작은 에너지/카운터 초기화, 상대 부식에 의한 실드 감소, 부족한 손패 드로우, 발버둥/랜섬웨어, 지연 효과, 오버클럭 감소, 코어 순서입니다. 턴 종료는 HP 대가, 임시 카드, 지연 효과, 코어, 약화 감소, 롤백 손패 복구를 처리합니다.

## 학습과 한계

AI의 티어 Baseline/가중치, 덱 구성, 매치 조합, 랜덤 선공은 분석 정책입니다. Unity EnemyAI의 행동 순서를 재현하지 않습니다. 최대 30회 행동/200라운드의 기본 안전 한도가 있으며 최대 라운드 도달은 `winner: 'draw'`, `termination: 'turn_limit'`로 기록합니다. 무승부를 임의 승패로 학습하지 않습니다.

테스트는 `node tests/run.mjs`, 원본 데이터 대조는 `node scripts/sync-newworld.mjs --check`로 실행합니다. 브라우저는 빌드 없이 정적 HTTP 서버로 실행합니다. Unity의 장면 연결이나 런타임은 별도로 확인해야 합니다.
