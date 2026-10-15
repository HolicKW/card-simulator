# Card Balance Simulator

NewWorld의 카드 데이터와 전투 규칙을 사용하는 웹 밸런스 시뮬레이터입니다. AI가 덱을 구성하고 대전을 반복하여 카드별 사용률, 승률, 팩 조합을 분석합니다.

[GitHub Pages](https://holickw.github.io/card-simulator/)

## 실행

정적 파일 서버에서 실행합니다. 브라우저에서는 별도 빌드나 패키지 설치가 필요하지 않습니다.

```powershell
python -m http.server 8080
```

브라우저에서 `http://127.0.0.1:8080`을 엽니다. 기존 `npx -y http-server . -p 8080 --cors -c-1` 명령도 사용할 수 있습니다.

## NewWorld 데이터 동기화

원본은 기본적으로 `D:\NewWorld\Assets\Resources\cards.json`과 `specialCards.json`입니다. 현재 스냅샷은 일반 카드 245장(6개 팩 각 40장 + IP 5장), 전투 중 생성되는 특수 카드 2장입니다. 특수 카드는 일반 덱 구성/학습 풀에서 제외합니다.

```powershell
node scripts/sync-newworld.mjs
node scripts/sync-newworld.mjs --check
node scripts/sync-newworld.mjs --source "D:\다른경로\NewWorld" --check
```

`NEWWORLD_PATH` 환경 변수로 기본 원본 경로를 바꿀 수도 있습니다. `--check`는 원본과 저장된 JSON/브라우저 모듈이 일치하지 않으면 종료 코드 1을 반환하며 파일을 수정하지 않습니다. 일반 동기화는 시뮬레이터의 스냅샷과 생성 모듈만 갱신합니다.

- `js/data/cards.json`, `js/data/specialCards.json`: 원본을 보관하는 로컬 스냅샷입니다. 별도 기획 데이터가 필요할 때도 이 스냅샷과 원본 수치를 대조합니다.
- `js/newworld-cards.js`: 정적 브라우저용 생성 모듈입니다. 직접 편집하지 않습니다.
- `js/cards.js`: 조회 API와 표시용 어댑터입니다. `Attack/Skill/Core`를 `attack/skill/power`로, 희귀도를 소문자로 표시하고 카드명 별칭과 설명 치환을 제공합니다. 효과·조건·코어·코스트 구조는 원본 필드를 유지합니다.

## 검증

Node.js 16 이상에서 의존성 설치 없이 실행합니다.

```powershell
npm test
npm run check:newworld
```

회귀 테스트는 데이터/핸들러 누락, 실제 코스트와 사용 조건, 턴 경계, 부식, 약화, 오버클럭, 재구축, 프로토콜, 바이러스, 도박/코어, 사망/부활 및 덱 소진을 검사합니다. 원본과의 데이터 일치는 별도 `check:newworld`로 확인합니다.

내보낸 학습 JSON에는 스키마/전투 규칙 버전과 카드 데이터 해시가 포함됩니다. 구형 규칙이나 다른 카드 수치로 학습한 파일은 불러오기를 거부하며 원래 파일을 수정하지 않습니다. 규칙을 변경하면 `LEARNING_RULESET_VERSION`도 갱신합니다.

## 시뮬레이션 범위

전투 규칙은 NewWorld C# 구현을 기준으로 합니다. 덱 구성, 카드 선택 가중치, 랜덤 선공, 대량 대전/학습은 시뮬레이터의 분석 정책입니다. AI의 선택 순서는 Unity EnemyAI와 같지 않습니다.

무한 순환을 방지하는 행동/턴 한도를 유지합니다. 최대 턴에 도달한 전투는 무승부로 기록하고 승패 학습에서 제외합니다. HP 우세나 A/B 동률 편향으로 승자를 만들지 않습니다. Unity 장면·애니메이션·네트워크 검증은 웹 회귀 테스트에 포함되지 않습니다.

구조와 수정 절차는 [ARCHITECTURE.md](ARCHITECTURE.md), [수정 시 체크리스트](수정_시_체크리스트.md)를 참고하세요.
