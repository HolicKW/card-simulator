# Card Balance Simulator

**신디게이트 서울** 게임의 카드 밸런스 조정을 위한 시뮬레이션 도구입니다.

AI가 자동으로 덱을 구성하고 수백 회의 전투를 반복하면서 각 카드의 실전 성능을 학습합니다. 시뮬레이션 결과를 통해 너무 강하거나(OP) 약한(UP) 카드를 찾아내고, 카드 간 시너지와 팩별 밸런스를 분석합니다.
깃허브 페이지 : https://holickw.github.io/card-simulator/

## 실행

```bash
npx -y http-server . -p 8080 --cors -c-1
```

브라우저에서 `http://127.0.0.1:8080` 접속 후, 파라미터를 설정하고 시뮬레이션을 실행하면 대시보드에서 분석 결과를 확인할 수 있습니다.

## 구조

```
js/
├── cards.js       # 카드 데이터 (base, overclock, dismantle, russian_roulette 팩)
├── effects.js     # 키워드 이펙트 처리
├── engine.js      # 전투 엔진
├── ai.js          # 학습 AI 및 덱 빌딩
├── simulator.js   # 시뮬레이션 실행 관리
└── app.js         # 대시보드 UI
```
