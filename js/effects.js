/**
 * effects.js — 키워드 이펙트 레지스트리
 * 
 * 각 키워드(오버클럭, 해체, 추출 등)의 로직을 독립 모듈로 등록.
 * 새 키워드 추가 시: EffectRegistry.register('키워드명', handlerFn) 한 줄이면 끝.
 */

export class EffectRegistry {
  constructor() {
    /** @type {Map<string, Function>} */
    this.handlers = new Map();
  }

  /**
   * 키워드 핸들러 등록
   * @param {string} keyword 
   * @param {(ctx: EffectContext) => void} handler 
   */
  register(keyword, handler) {
    this.handlers.set(keyword, handler);
  }

  /**
   * 키워드 핸들러 실행
   * @param {string} keyword 
   * @param {EffectContext} ctx 
   */
  execute(keyword, ctx) {
    const handler = this.handlers.get(keyword);
    if (!handler) {
      console.warn(`[EffectRegistry] Unknown keyword: ${keyword}`);
      return;
    }
    handler(ctx);
  }

  has(keyword) {
    return this.handlers.has(keyword);
  }
}

/**
 * @typedef {Object} EffectContext
 * @property {import('./engine.js').BattleState} state
 * @property {Object} caster - 시전자 (player or enemy)
 * @property {Object} target - 대상
 * @property {Object} card - 사용된 카드
 * @property {Object} effect - 개별 이펙트 데이터 { type, value, ... }
 * @property {import('./engine.js').BattleEngine} engine
 */

/**
 * 기본 이펙트 핸들러들을 레지스트리에 등록
 * @param {EffectRegistry} registry 
 */
export function registerCoreEffects(registry) {

  // 오버클럭 스케일 적용 헬퍼: effect에 overclockScale: true가 있고 ctx.overclockScale > 0이면 value * scale
  const ocVal = (ctx) =>
    (ctx.effect.overclockScale && ctx.overclockScale > 0)
      ? ctx.effect.value * ctx.overclockScale
      : ctx.effect.value;

  // 디메리트 전용 오버클럭 스케일 헬퍼: fixedDemerit 파워가 있으면 스택을 고정값으로 대체
  const demeritOcVal = (ctx) => {
    if (!ctx.effect.overclockScale) return ctx.effect.value;
    const scale = ctx.demeritOCScale ?? ctx.overclockScale;
    return scale > 0 ? ctx.effect.value * scale : ctx.effect.value;
  };

  // 디메리트 소스 스택 헬퍼: overclockStacks 소스일 때 fixedDemerit 고정값 적용
  const demeritStacks = (ctx, source) =>
    (source === 'overclockStacks' && ctx.demeritOCScale !== undefined)
      ? ctx.demeritOCScale
      : (ctx.caster[source] || 0);

  // 자해 헬퍼: 방어도 먼저 소모 후 체력 차감, selfDamageThisTurn 추적
  const applySelfDamage = (caster, amount) => {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    // 다음 카드 자해 면제 플래그 체크
    if (caster._preventSelfDamageThisCard) return;
    const shieldAbs = Math.min(caster.shield || 0, amount);
    caster.shield -= shieldAbs;
    const hpLoss = amount - shieldAbs;
    caster.hp = Math.max(0, (caster.hp || 0) - hpLoss);
    caster.selfDamageThisTurn = (caster.selfDamageThisTurn || 0) + hpLoss;
  };

  // ─── 기본 이펙트 ───
  registry.register('damage', (ctx) => {
    let dmg = ocVal(ctx);
    // 힘/약화: 배율(scale)이 있으면 항상 적용 (데미지+힘 × 배율), 없으면 카드당 1회만 적용
    const hasScale = ctx.effect.scale !== undefined;
    const applyStr = hasScale || !ctx._dmgFlags?.strengthApplied;
    if (applyStr) {
      dmg += (ctx.caster.strength || 0);
      dmg -= (ctx.caster.weakness || 0);
      if (ctx._dmgFlags) ctx._dmgFlags.strengthApplied = true;
    }
    // 네트워크 퍼마넌트 버프 적용
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkDamageBuff) {
      dmg += ctx.caster.networkDamageBuff;
    }
    // 배율 적용 (strength/weakness 이후)
    if (hasScale) dmg = Math.floor(dmg * ctx.effect.scale);
    // 동적 배율: scaleSource가 있으면 caster의 해당 스탯 값을 배율로 사용
    if (ctx.effect.scaleSource !== undefined) {
      dmg = Math.floor(dmg * (ctx.caster[ctx.effect.scaleSource] || 0));
    }
    if (dmg < 1) dmg = 1;

    const hits = ctx.effect.hits || 1;
    for (let i = 0; i < hits; i++) {
      ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
    }
  });

  registry.register('shield', (ctx) => {
    let val = ctx.effect.value;
    // 네트워크 퍼마넌트 버프 적용
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkShieldBuff) {
      val += ctx.caster.networkShieldBuff;
    }
    ctx.caster.shield = (ctx.caster.shield || 0) + val;
  });

  registry.register('heal', (ctx) => {
    const amount = ctx.effect.value;
    ctx.caster.hp = Math.min(ctx.caster.hp + amount, ctx.caster.maxHp);
  });

  registry.register('healPercent', (ctx) => {
    const amount = Math.floor(ctx.caster.maxHp * (ctx.effect.value / 100));
    ctx.caster.hp = Math.min(ctx.caster.hp + amount, ctx.caster.maxHp);
  });

  registry.register('draw', (ctx) => {
    const count = Math.floor(ocVal(ctx));
    for (let i = 0; i < count; i++) {
      ctx.engine.drawCard(ctx.caster);
    }
  });

  registry.register('energy', (ctx) => {
    ctx.caster.energy = (ctx.caster.energy || 0) + Math.floor(ocVal(ctx));
  });

  // 다음 턴 시작 시 에너지 획득 (전력 재분배 등)
  registry.register('energyNextTurn', (ctx) => {
    ctx.caster.energyNextTurn = (ctx.caster.energyNextTurn || 0) + ctx.effect.value;
  });

  // 이번 턴 추출 발동마다 에너지 +1 버프 설치 (무한 동력 수배)
  // 중첩 안 됨 — 이미 설정된 값보다 큰 경우만 갱신
  registry.register('setupExtractEnergy', (ctx) => {
    ctx.caster.extractEnergyBonusLeft = Math.max(ctx.caster.extractEnergyBonusLeft || 0, ctx.effect.value);
  });

  // 남은 에너지 전소모 후 ctx.energyConsumed에 저장 (후속 이펙트에서 활용)
  registry.register('consumeAllEnergy', (ctx) => {
    ctx.energyConsumed = Math.max(0, ctx.caster.energy || 0);
    ctx.caster.energy = 0;
  });

  // 턴 강제 종료
  registry.register('forceTurnEnd', (ctx) => {
    ctx.caster.forceEndTurn = true;
  });

  // 덱에서 조건에 맞는 카드 서치 후 패에 추가
  // effect: {
  //   type: 'searchByType',
  //   cardType: 'power'|'attack'|'skill',  — 단일 타입 필터 (기존)
  //   cardTypes: ['power','skill'],          — 복수 타입 필터
  //   keyword: 'network',                   — 키워드 필터
  //   value: count,                         — 서치 장수
  //   fromTop: true,                        — 덱 맨 위(인덱스 0)부터 탐색 (기본: 무작위)
  //   keepCost: true,                       — 코스트 변경 없음
  //   costAdd: -1,                          — 코스트 N 감소 (최소 0)
  //   (기본 동작: costSet 없으면 cost = 0)
  // }
  registry.register('searchByType', (ctx) => {
    const { cardType, cardTypes, keyword, value: count, fromTop, keepCost, costAdd } = ctx.effect;
    const pile = ctx.caster.drawPile;
    let found = 0;
    const maxFind = count || 1;

    const matchFn = (card) => {
      if (cardTypes) return cardTypes.includes(card.type);
      if (cardType) return card.type === cardType;
      if (keyword) return card.keywords?.includes(keyword);
      return false;
    };

    const applyCost = (card) => {
      if (keepCost) return;
      if (costAdd !== undefined) card.cost = Math.max(0, (card.cost || 0) + costAdd);
      else card.cost = 0;
    };

    if (fromTop) {
      for (let i = 0; i < pile.length && found < maxFind; i++) {
        if (matchFn(pile[i])) {
          const card = pile.splice(i, 1)[0];
          applyCost(card);
          ctx.caster.hand.push(card);
          found++;
          i--;
        }
      }
    } else {
      for (let i = pile.length - 1; i >= 0 && found < maxFind; i--) {
        if (matchFn(pile[i])) {
          const card = pile.splice(i, 1)[0];
          applyCost(card);
          ctx.caster.hand.push(card);
          found++;
        }
      }
    }
  });

  // 손패에서 가장 코스트 높은 카드 1장 코스트 0 (데이터 클로닝용)
  registry.register('zeroCostHandCard', (ctx) => {
    const hand = ctx.caster.hand;
    if (!hand || hand.length === 0) return;
    let maxIdx = 0;
    for (let i = 1; i < hand.length; i++) {
      if ((hand[i].cost || 0) > (hand[maxIdx].cost || 0)) maxIdx = i;
    }
    hand[maxIdx].cost = 0;
  });

  // 덱에서 무작위 N장 공개 → 최고 코스트 1장만 패에 추가(코스트 0), 나머지는 덱 맨 위로 복귀
  // effect: {
  //   type: 'revealAndTakeHighestCost',
  //   value: 3,   — 공개할 카드 수 (기본 3)
  // }
  registry.register('revealAndTakeHighestCost', (ctx) => {
    const pile = ctx.caster.drawPile;
    if (!pile || pile.length === 0) return;
    const count = Math.min(ctx.effect.value || 3, pile.length);

    // 덱에서 무작위 count개 추출 (인덱스 역순 정렬로 splice 오염 방지)
    const available = Array.from({ length: pile.length }, (_, i) => i);
    const chosen = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * available.length);
      chosen.push(available.splice(r, 1)[0]);
    }
    chosen.sort((a, b) => b - a);
    const revealed = chosen.map(i => pile.splice(i, 1)[0]);

    // 최고 코스트 카드 찾기
    let maxIdx = 0;
    for (let i = 1; i < revealed.length; i++) {
      if ((revealed[i].cost || 0) > (revealed[maxIdx].cost || 0)) maxIdx = i;
    }

    // 최고 코스트 카드 → 패에 코스트 0으로 추가
    const taken = revealed.splice(maxIdx, 1)[0];
    taken.cost = 0;
    ctx.caster.hand.push(taken);

    // 나머지 → 덱 맨 위로 복귀
    pile.unshift(...revealed);
  });

  // 덱에서 가장 코스트 높은 카드 N장 서치 + 코스트 0 (마스터 오버라이드 등)
  registry.register('searchHighestCostFromDeck', (ctx) => {
    const pile = ctx.caster.drawPile;
    if (!pile || pile.length === 0) return;
    const count = ctx.effect.value || 1;
    for (let i = 0; i < count && pile.length > 0; i++) {
      let maxIdx = 0;
      for (let j = 1; j < pile.length; j++) {
        if ((pile[j].cost || 0) > (pile[maxIdx].cost || 0)) maxIdx = j;
      }
      const card = pile.splice(maxIdx, 1)[0];
      card.cost = 0;
      ctx.caster.hand.push(card);
    }
  });

  registry.register('shieldBreak', (ctx) => {
    const amount = ctx.effect.value;
    ctx.target.shield = Math.max(0, (ctx.target.shield || 0) - amount);
  });

  // 적 방어도 전부 파괴 후 파괴량의 fraction만큼 피해 (방어막 파쇄기용)
  // effect: { type: 'shieldBreakAllAndDamage', fraction: 0.5 }
  registry.register('shieldBreakAllAndDamage', (ctx) => {
    const destroyed = ctx.target.shield || 0;
    ctx.target.shield = 0;
    const dmg = Math.floor(destroyed * (ctx.effect.fraction ?? 0.5));
    if (dmg > 0 && ctx.engine) ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
  });

  // 손패 모든 공격 카드 코스트 1 감소 (최소 0) (광역 전술 지시용)
  registry.register('costReduceAttackCards', (ctx) => {
    for (const card of (ctx.caster.hand || [])) {
      if (card.type === 'attack') card.cost = Math.max(0, (card.cost || 0) - 1);
    }
  });

  // ─── 상태이상 ───
  // modifyStat: 캐스터/타겟의 임의 스탯을 value만큼 증감
  //   stat: 'strength' | 'weakness' | 'overload' | ...
  //   target: 'self'(기본=캐스터) | 'enemy'(타겟)
  registry.register('modifyStat', (ctx) => {
    const entity = ctx.effect.target === 'enemy' ? ctx.target : ctx.caster;
    entity[ctx.effect.stat] = (entity[ctx.effect.stat] || 0) + ctx.effect.value;
  });

  // 자주 쓰이는 alias — cards.js에서 간결하게 사용 가능
  registry.register('strength', (ctx) => {
    ctx.caster.strength = (ctx.caster.strength || 0) + ctx.effect.value;
  });
  registry.register('weakness', (ctx) => {
    ctx.target.weakness = (ctx.target.weakness || 0) + ctx.effect.value;
  });

  // ─── 자신에게 약화 (B형식 스케일링) ───
  registry.register('scaledSelfWeakness', (ctx) => {
    const scaling = ctx.effect.scaling;
    const amount = Math.floor((ctx.effect.value || 0) + (ctx.caster[scaling.source] || 0) * (scaling.multiplier || 1));
    ctx.caster.weakness = (ctx.caster.weakness || 0) + amount;
  });

  // ─── 자해 ───
  registry.register('selfDamage', (ctx) => {
    applySelfDamage(ctx.caster, demeritOcVal(ctx));
  });

  // ─── 스케일링 자해 % (base% + 스택 × multiplier% of maxHp) ───
  registry.register('scaledSelfDamagePercent', (ctx) => {
    const scaling = ctx.effect.scaling;
    const pct = (ctx.effect.value || 0) + demeritStacks(ctx, scaling.source) * (scaling.multiplier || 1);
    applySelfDamage(ctx.caster, ctx.caster.maxHp * (pct / 100));
  });

  // ─── 스케일링 드로우 (base + 스택 × multiplier) ───
  registry.register('scaledDraw', (ctx) => {
    const scaling = ctx.effect.scaling;
    const count = Math.floor((ctx.effect.value || 0) + (ctx.caster[scaling.source] || 0) * (scaling.multiplier || 1));
    for (let i = 0; i < count; i++) {
      ctx.engine.drawCard(ctx.caster);
    }
  });

  // ─── 스케일링 자해 (base + 오버클럭 스택 × multiplier) ───
  registry.register('scaledSelfDamage', (ctx) => {
    const scaling = ctx.effect.scaling;
    const amount = (ctx.effect.value || 0) + demeritStacks(ctx, scaling.source) * (scaling.multiplier || 1);
    applySelfDamage(ctx.caster, amount);
  });

  // 최대 체력 비율 자해 (value = %, 예: 20 → 최대 체력의 20%)
  registry.register('selfDamagePercent', (ctx) => {
    applySelfDamage(ctx.caster, ctx.caster.maxHp * (ctx.effect.value / 100));
  });

  // ─── 과부하 ───
  registry.register('overload', (ctx) => {
    let amount = ctx.effect.value || 0;
    if (ctx.effect.scaling) {
      // base + stacks × multiplier 형식 (영구 기관 코어 고정값 적용)
      amount += demeritStacks(ctx, ctx.effect.scaling.source) * (ctx.effect.scaling.multiplier || 1);
    } else if (ctx.effect.overclockScale) {
      amount = Math.floor(demeritOcVal(ctx));
    }
    ctx.caster.overloadNext = (ctx.caster.overloadNext || 0) + Math.floor(amount);
  });

  registry.register('overloadReduce', (ctx) => {
    ctx.caster.overloadNext = Math.max(0, (ctx.caster.overloadNext || 0) - (ctx.effect.value || 1));
  });

  // 다음 카드 자해 면제 (오버클럭 threshold 이상일 때 플래그 설정)
  registry.register('preventSelfDamageIfOverclock', (ctx) => {
    const threshold = ctx.effect.threshold || 1;
    if ((ctx.caster.overclockStacks || 0) >= threshold) {
      ctx.caster.preventNextCardSelfDamage = true;
    }
  });

  // ─── 적 에너지 감소 (다음 턴) ───
  registry.register('energyDrain', (ctx) => {
    ctx.target.energyDrainNext = (ctx.target.energyDrainNext || 0) + (ctx.effect.value || 1);
  });

  // ─── 오버클럭 스택 ───
  registry.register('overclockGain', (ctx) => {
    ctx.caster.overclockStacks = Math.min(
      (ctx.caster.overclockStacks || 0) + ctx.effect.value,
      ctx.caster.overclockMax || 4
    );
  });

  registry.register('overclockConsume', (ctx) => {
    const consumed = ctx.caster.overclockStacks || 0;
    ctx.caster.overclockStacks = 0;
    // consumed 값을 컨텍스트에 저장해 후속 이펙트에서 사용
    ctx.overclockConsumed = consumed;
    // 오버드라이브 코어: 소모된 스택 수만큼 패의 해당 카드 코스트 감소
    if (consumed > 0 && ctx.engine) {
      ctx.engine._reduceOverdriveCost(ctx.caster, consumed);
    }
  });

  registry.register('overclockReduce', (ctx) => {
    const before = ctx.caster.overclockStacks || 0;
    ctx.caster.overclockStacks = Math.max(0, before - ctx.effect.value);
    const actualReduced = before - ctx.caster.overclockStacks;
    // 오버드라이브 코어: 감소된 스택 수만큼 패의 해당 카드 코스트 감소
    if (actualReduced > 0 && ctx.engine) {
      ctx.engine._reduceOverdriveCost(ctx.caster, actualReduced);
    }
  });

  // 과전류 조건부 (threshold check는 카드 레벨에서 처리)
  registry.register('overcurrent', (ctx) => {
    // 이미 조건 체크된 후 호출됨 — 메인 이펙트 실행
    if (ctx.effect.effects) {
      for (const subEffect of ctx.effect.effects) {
        registry.execute(subEffect.type, { ...ctx, effect: subEffect });
      }
    }
  });

  // ─── 오버클럭 리셋 (전량 소모 후 0으로 초기화) ───
  registry.register('overclockReset', (ctx) => {
    const before = ctx.caster.overclockStacks || 0;
    ctx.caster.overclockStacks = 0;
    // 오버드라이브 코어: 리셋된 스택 수만큼 패의 해당 카드 코스트 감소
    if (before > 0 && ctx.engine) {
      ctx.engine._reduceOverdriveCost(ctx.caster, before);
    }
  });

  // ─── 오버드라이브 코어 코스트 감소 (패시브 마커) ───
  registry.register('costReductionPerOverclock', (ctx) => {
    // 실제 코스트 감소는 overclockConsume/Reduce/Reset 시점에서 처리됨
    // 이 핸들러는 카드 플레이 시 호출되지만 추가 액션 불필요
  });

  // 에너지 획득형 해체: 코스트 높고 가치 낮은 카드 선택 해체 → 본래 비용(_oldCost || cost)만큼 에너지 + 드로우 1
  registry.register('dismantleForEnergy', (ctx) => {
    const hand = ctx.caster.hand;
    if (!hand || hand.length === 0) return;
    const log = ctx.usageLog || ctx.state?.cardUsageLog;
    const idx = ctx.engine._findHighCostLowValueCard(hand);
    const card = hand.splice(idx, 1)[0];
    if (!card) return;

    const energyGain = card._oldCost ?? card.cost ?? 0;
    ctx.caster.void = ctx.caster.void || [];
    ctx.caster.void.push(card);
    ctx.caster.dismantledThisTurn = (ctx.caster.dismantledThisTurn || 0) + 1;
    ctx.caster.dismantledThisBattle = (ctx.caster.dismantledThisBattle || 0) + 1;
    ctx.caster.lastDismantledCardType = card.type;
    ctx.caster.energy = (ctx.caster.energy || 0) + energyGain;
    if (ctx.engine) ctx.engine.drawCard(ctx.caster);
    if (log) log.push({ type: 'dismantle', source: ctx.card?.name, cardName: card.name, effect: `에너지 +${energyGain}, 드로우 1` });
  });

  // ─── 해체 ───
  registry.register('dismantle', (ctx) => {
    const count = Math.floor(ocVal(ctx)) || 1;
    const random = ctx.effect.random !== false; // 기본 무작위
    for (let i = 0; i < count; i++) {
      ctx.engine.dismantleCard(ctx.caster, random, `Card Effect: ${ctx.card?.name}`, ctx.usageLog || ctx.state?.cardUsageLog);
    }
  });

  // ─── 덱 위 N장 해체 ───
  registry.register('dismantleTop', (ctx) => {
    const count = ctx.effect.value || 1;
    const log = ctx.usageLog || ctx.state?.cardUsageLog;
    for (let i = 0; i < count; i++) {
      if (!ctx.caster.drawPile || ctx.caster.drawPile.length === 0) break;
      const card = ctx.caster.drawPile.shift();
      ctx.caster.void.push(card);
      ctx.caster.dismantledThisTurn = (ctx.caster.dismantledThisTurn || 0) + 1;
      ctx.caster.dismantledThisBattle = (ctx.caster.dismantledThisBattle || 0) + 1;
      if (log) log.push({ type: 'dismantle', source: `Card Effect: ${ctx.card?.name}`, cardName: card.name });
    }
  });

  // ─── 해체된 카드 타입 조건부 (attack/skill/power 분기) ───
  registry.register('conditionalByDismantledType', (ctx) => {
    const dismantledType = ctx.caster.lastDismantledCardType;
    if (!dismantledType) return;
    const effects = ctx.effect[dismantledType] || [];
    for (const subEffect of effects) {
      registry.execute(subEffect.type, { ...ctx, effect: subEffect });
    }
  });

  // ─── 추출 (트리거 — 해체 시 발동) ───
  registry.register('extract', (ctx) => {
    // 추출 효과는 dismantleCard 내부에서 트리거됨
    if (ctx.effect.effects) {
      for (const subEffect of ctx.effect.effects) {
        registry.execute(subEffect.type, { ...ctx, effect: subEffect });
      }
    }
  });

  // ─── 재구축 ───
  registry.register('rebuild', (ctx) => {
    // 카드 사용 후 소멸 대신 핸드로 복귀시키는 처리는 engine.playCard 에서 수행.
    // 여기서는 명시적 이펙트로 호출될 때(가비지 콜렉터 등) 추가적인 로직이나 로그, 재구축 관련 파워 발동 처리
  });

  // ─── 최대체력 감소 ───
  registry.register('maxHpReduce', (ctx) => {
    ctx.caster.maxHp = Math.max(1, ctx.caster.maxHp - Math.floor(ocVal(ctx)));
    if (ctx.caster.hp > ctx.caster.maxHp) {
      ctx.caster.hp = ctx.caster.maxHp;
    }
  });

  // ─── 스케일링 최대 체력 감소 (scaledDamage와 동일한 구조) ───
  registry.register('scaledMaxHpReduce', (ctx) => {
    const scaling = ctx.effect.scaling;
    let amount = (ctx.effect.value || 0) + (ctx.caster[scaling.source] || 0) * (scaling.multiplier || 1);
    amount = Math.floor(amount);
    ctx.caster.maxHp = Math.max(1, ctx.caster.maxHp - amount);
    if (ctx.caster.hp > ctx.caster.maxHp) {
      ctx.caster.hp = ctx.caster.maxHp;
    }
  });

  // ─── 조건부 이펙트 ───
  registry.register('conditional', (ctx) => {
    const { condition, thenEffects, elseEffects } = ctx.effect;
    let condMet = false;

    switch (condition.type) {
      case 'hpBelow':
        condMet = ctx.caster.hp <= ctx.caster.maxHp * (condition.value / 100);
        break;
      case 'overclockMin':
        condMet = (ctx.caster.overclockStacks || 0) >= condition.value;
        break;
      case 'dismantledThisTurn':
        condMet = (ctx.caster.dismantledThisTurn || 0) >= condition.value;
        break;
      case 'dismantledThisBattle':
        condMet = (ctx.caster.dismantledThisBattle || 0) >= condition.value;
        break;
      case 'targetHpBelow':
        condMet = ctx.target.hp <= ctx.target.maxHp * (condition.value / 100);
        break;
      case 'networkCardsPlayed':
        condMet = (ctx.caster.networkCardsPlayedThisTurn || 0) >= condition.value;
        break;
      case 'cardsPlayedThisTurn':
        condMet = (ctx.caster.cardsPlayedThisTurn || 0) >= condition.value;
        break;
      case 'enemyHasWeakness':
        condMet = (ctx.target.weakness || 0) > 0;
        break;
      case 'accumulationMet':
        condMet = (ctx.card.accumulationStack || 0) >= (ctx.card.accumulationTarget || 0);
        break;
      default:
        break;
    }

    const effects = condMet ? thenEffects : (elseEffects || []);
    for (const subEffect of effects) {
      registry.execute(subEffect.type, { ...ctx, effect: subEffect });
    }
  });

  // ─── 스케일링 이펙트 (값이 다른 수치에 비례) ───
  registry.register('scaledDamage', (ctx) => {
    let base = ocVal(ctx) || 0;  // overclockScale 적용 가능한 base
    const scaling = ctx.effect.scaling;
    // scaling.multiplier도 overclockScale 대상일 수 있음 (overclockScaleMultiplier: true)
    const mult = (scaling.overclockScaleMultiplier && ctx.overclockScale > 0)
      ? (scaling.multiplier || 1) * ctx.overclockScale
      : (scaling.multiplier || 1);

    switch (scaling.source) {
      case 'selfDamageThisTurn':
        base += (ctx.caster.selfDamageThisTurn || 0) * mult;
        break;
      case 'overclockConsumed':
        base += (ctx.overclockConsumed || 0) * mult;
        break;
      case 'dismantledThisBattle':
        base += (ctx.caster.dismantledThisBattle || 0) * mult;
        break;
      case 'overloadStacks':
        base += (ctx.caster.overloadNext || 0) * mult;
        break;
      case 'targetLostHp': {
        const lost = ctx.target.maxHp - ctx.target.hp;
        const dynMult = scaling.stackScaling
          ? mult + (ctx.caster.overclockStacks || 0) * scaling.stackScaling
          : mult;
        base += Math.min(lost * dynMult, scaling.max || 999);
        break;
      }
      case 'networkStacks':
        base += (ctx.caster.networkStacks || 0) * mult;
        break;
      case 'overclockStacks':
        base += (ctx.caster.overclockStacks || 0) * mult;
        break;
      case 'totalDamageThisTurn':
        base += (ctx.caster.totalDamageThisTurn || 0) * mult;
        break;
      default: break;
    }

    // 힘/약화: 카드당 1회만 적용
    const applyStr = !ctx._dmgFlags?.strengthApplied;
    let dmg = applyStr ? base + (ctx.caster.strength || 0) : base;
    // 네트워크 퍼마넌트 버프
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkDamageBuff) {
      dmg += ctx.caster.networkDamageBuff;
    }
    if (applyStr) {
      dmg -= (ctx.caster.weakness || 0);
      if (ctx._dmgFlags) ctx._dmgFlags.strengthApplied = true;
    }
    if (dmg < 1) dmg = 1;
    ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
  });

  // ─── 스케일링 방어도 ───
  registry.register('scaledShield', (ctx) => {
    let base = ctx.effect.value || 0;
    const scaling = ctx.effect.scaling;

    switch (scaling.source) {
      case 'overclockConsumed':
        base += (ctx.overclockConsumed || 0) * (scaling.multiplier || 1);
        break;
      case 'dismantledCount':
        base += (ctx.caster.dismantledThisTurn || 0) * (scaling.multiplier || 1);
        break;
      case 'networkStacks':
        base += (ctx.caster.networkStacks || 0) * (scaling.multiplier || 1);
        break;
      case 'targetVirus':
        base += Math.floor((ctx.target.virus || 0) * (scaling.multiplier || 1));
        break;
      case 'energyConsumed':
        base += (ctx.energyConsumed || 0) * (scaling.multiplier || 1);
        break;
      default: break;
    }
    // 네트워크 퍼마넌트 버프
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkShieldBuff) {
      base += ctx.caster.networkShieldBuff;
    }
    ctx.caster.shield = (ctx.caster.shield || 0) + base;
  });
  // 바이러스 디버프 (적 공격력 향후 연계/소모용 화폐)
  registry.register('virus', (ctx) => {
    ctx.target.virus = (ctx.target.virus || 0) + ctx.effect.value;

    // 전염병 연구소 파워 체크 (바이러스 부여 시 +1)
    if (ctx.engine.hasPower(ctx.caster, 'viral_lab')) {
      ctx.target.virus += 1;
    }
  });

  // 바이러스 2배 증가
  registry.register('doubleVirus', (ctx) => {
    ctx.target.virus = (ctx.target.virus || 0) * 2;
  });

  // 부식 디버프 (턴 시작시 방어도부터 깎는 DoT)
  registry.register('corrosion', (ctx) => {
    // 대상 지정인지, 자신인지 확인
    let target = ctx.target;
    if (ctx.effect.target === 'self') target = ctx.caster;
    target.corrosion = (target.corrosion || 0) + ctx.effect.value;
  });

  // ─── 바이러스 소모 통합 핸들러 (consumeVirus) ───
  // 파라미터:
  //   consume: 'all' | 'scaled' | number  — 소모량 결정
  //   max: number                         — consume='scaled' 시 최대 소모량
  //   threshold: number                   — 발동에 필요한 최소 바이러스 (미지정 시 consume 값 사용)
  //   multiplier: number                  — 소모량 × multiplier 만큼 피해
  //   shield: number                      — 고정 방어도 획득
  //   shieldPerStack: number              — 소모 스택 1당 방어도
  //   draw: number                        — 카드 드로우
  //   energy: number                      — 에너지 획득
  //   heal: number                        — 체력 회복
  //   strength: number                    — 힘 획득
  //   applyCorrosionRatio: number         — 소모량 × ratio 만큼 부식 부여
  //   thenEffects: []                     — 소모 성공 시 실행할 서브이펙트
  registry.register('consumeVirus', (ctx) => {
    const virusCount = ctx.target.virus || 0;
    const eff = ctx.effect;

    // 1) 소모량 결정
    let consumeAmount;
    const consumeValue = eff.consume !== undefined ? eff.consume : eff.value;
    if (consumeValue === 'all') {
      consumeAmount = virusCount;
    } else if (consumeValue === 'scaled') {
      consumeAmount = Math.min(virusCount, eff.max || 15);
    } else {
      consumeAmount = Math.min(virusCount, Number(consumeValue) || 0);
    }

    // 2) 발동 조건 체크
    const threshold = eff.threshold !== undefined ? eff.threshold : consumeAmount;
    if (virusCount < threshold) return;
    if (consumeAmount <= 0 && !eff.draw && !eff.energy && !eff.shield && !eff.heal && !eff.strength) return;

    // 3) 소모
    if (consumeAmount > 0) {
      ctx.target.virus -= consumeAmount;
    }

    // 4) 효과 발동
    if (eff.multiplier) {
      const dmg = consumeAmount * eff.multiplier;
      ctx.engine.applyDamage(ctx.target, dmg, ctx.caster, true);
    }
    if (eff.shieldPerStack) {
      ctx.caster.shield = (ctx.caster.shield || 0) + consumeAmount * eff.shieldPerStack;
    }
    if (eff.shield) ctx.caster.shield = (ctx.caster.shield || 0) + eff.shield;
    if (eff.draw) ctx.engine._drawCards(ctx.caster, eff.draw);
    if (eff.energy) ctx.caster.energy = Math.min((ctx.caster.energy || 0) + eff.energy, ctx.caster.maxEnergyPool || 10);
    if (eff.heal) ctx.engine.heal(ctx.caster, eff.heal);
    if (eff.strength) ctx.caster.strength = (ctx.caster.strength || 0) + eff.strength;
    if (eff.applyCorrosionRatio) {
      const corr = Math.floor(consumeAmount * eff.applyCorrosionRatio);
      if (corr > 0) ctx.target.corrosion = (ctx.target.corrosion || 0) + corr;
    }

    // 5) thenEffects (서브이펙트 재귀 실행)
    if (eff.thenEffects) {
      for (const subEffect of eff.thenEffects) {
        // scaled 값 → 소모량 기반으로 실제 수치 치환
        let resolved = subEffect;
        if (subEffect.value === 'scaled') {
          const val = Math.min(
            Math.floor(consumeAmount * (subEffect.factor || 1)),
            subEffect.max || Infinity
          );
          resolved = { ...subEffect, value: val };
        }
        registry.execute(resolved.type, { ...ctx, effect: resolved, overdriveConsumed: consumeAmount });
      }
    }

    // 6) 파워 트리거
    if (consumeAmount > 0) {
      ctx.engine._triggerVirusConsumePowers(ctx.caster, consumeAmount);
    }
  });

  // 하위 호환 alias — 기존 이름으로도 동작
  registry.register('consumeVirusForDamage', (ctx) => registry.execute('consumeVirus', ctx));
  registry.register('consumeVirusForUtility', (ctx) => registry.execute('consumeVirus', ctx));
  registry.register('overdrive', (ctx) => registry.execute('consumeVirus', ctx));

  // 3. 적 부식/바이러스 비례 피해 (부식 1당 피해, 네크로시스, 오메가 변이 등)
  registry.register('damageByDebuff', (ctx) => {
    let stack = 0;
    if (ctx.effect.debuff === 'corrosion') stack = ctx.target.corrosion || 0;
    else if (ctx.effect.debuff === 'virus') stack = ctx.target.virus || 0;

    if (stack > 0) {
      let dmg = stack * ctx.effect.multiplier;
      ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
    }
  });

  // 4-a. 디버프 스택 비례 바이러스 부여 (보균자 역류: 부식 스택 1당 바이러스 1)
  registry.register('virusByDebuff', (ctx) => {
    let stack = 0;
    if (ctx.effect.debuff === 'corrosion') stack = ctx.target.corrosion || 0;
    else if (ctx.effect.debuff === 'virus') stack = ctx.target.virus || 0;
    if (stack > 0) {
      const amount = Math.floor(stack * (ctx.effect.multiplier || 1));
      ctx.target.virus = (ctx.target.virus || 0) + amount;
      if (ctx.engine.hasPower(ctx.caster, 'viral_lab')) {
        ctx.target.virus += 1;
      }
    }
  });

  // 4. 용해성 맹독 전용 (폭주(6) 기준)
  registry.register('meltToxin', (ctx) => {
    if ((ctx.target.virus || 0) >= 6) {
      ctx.target.virus -= 6;
      if (ctx.engine) ctx.engine.applyDamage(ctx.target, 10, ctx.caster); // 10 피해
      ctx.target.weakness = (ctx.target.weakness || 0) + 2; // 약화 2
      ctx.target.corrosion = (ctx.target.corrosion || 0) + 5; // 부식 5 부여
      ctx.engine._triggerVirusConsumePowers(ctx.caster, 6);
    }
  });

  // 5. 조건부 스킬/공격 (숙주 기생, 부식 침투탄, 괴사 침식, 세포 용해 폭탄)
  registry.register('conditionalAdd', (ctx) => {
    let pass = false;
    if (ctx.effect.condition === 'virusTarget' && (ctx.target.virus || 0) >= ctx.effect.conditionValue) pass = true;
    if (ctx.effect.condition === 'targetShieldZero' && (ctx.target.shield || 0) === 0) pass = true;
    if (ctx.effect.condition === 'corrosionTarget' && (ctx.target.corrosion || 0) >= ctx.effect.conditionValue) pass = true;

    if (pass) {
      if (ctx.effect.addDamage) {
        let dmg = ctx.effect.addDamage + (ctx.caster.strength || 0) - (ctx.caster.weakness || 0);
        if (dmg < 1) dmg = 1;
        ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
      }
      if (ctx.effect.addVirus) ctx.target.virus = (ctx.target.virus || 0) + ctx.effect.addVirus;
      if (ctx.effect.destroyShield) ctx.target.shield = 0;
      if (ctx.effect.consumeCorrosion) ctx.target.corrosion = 0;
      if (ctx.effect.setStrengthZero) ctx.target.strength = 0;
      if (ctx.effect.halveStrength) ctx.target.strength = Math.floor((ctx.target.strength || 0) / 2);
    }
  });

  // 하위 호환 alias — consumeVirusForShieldScale
  registry.register('consumeVirusForShieldScale', (ctx) => registry.execute('consumeVirus', ctx));

  // 소모 스택당 방어도 (thenEffects 내부에서 overdriveConsumed로 참조)
  registry.register('shieldPerStack', (ctx) => {
    const consumed = ctx.overdriveConsumed || 0;
    ctx.caster.shield = (ctx.caster.shield || 0) + consumed * (ctx.effect.value || 3);
  });
  // 하위 호환 alias
  registry.register('shieldPerOverdrive', (ctx) => registry.execute('shieldPerStack', ctx));

  // 메모리 최적화 — 패 전체 해체 후 해체 수만큼 드로우
  registry.register('dismantleAllAndScaleDraw', (ctx) => {
    const handSize = ctx.caster.hand.length;
    for (let i = handSize - 1; i >= 0; i--) {
      ctx.engine.dismantleCard(ctx.caster, false, '메모리 최적화', ctx.state?.cardUsageLog);
    }
    for (let i = 0; i < handSize; i++) {
      ctx.engine.drawCard(ctx.caster);
    }
  });

  // 시스템 롤백 — 패 전체 해체 후 void 최근 N장 임시 회수 (턴 종료 시 영구 소멸)
  registry.register('dismantleAllAndVoidRecall', (ctx) => {
    const log = ctx.state?.cardUsageLog;
    const handSize = ctx.caster.hand.length;
    for (let i = handSize - 1; i >= 0; i--) {
      ctx.engine.dismantleCard(ctx.caster, false, '시스템 롤백', log);
    }
    const voidPile = ctx.caster.void || [];
    const recallCount = Math.min(ctx.effect.recallCount || 4, voidPile.length);
    for (let i = 0; i < recallCount; i++) {
      const card = voidPile.pop();
      card._tempCard = true;
      ctx.caster.hand.push(card);
      if (log) log.push({ type: 'info', msg: `시스템 롤백: ${card.name} 임시 회수` });
    }
  });

  // 8. 강제 데이터 덤프 — 패 전체 해체 후 해체 수 × 방어도
  registry.register('dismantleAllAndScaleShield', (ctx) => {
    const handSize = ctx.caster.hand.length;
    const multiplier = ctx.effect.multiplier || 10;
    for (let i = handSize - 1; i >= 0; i--) {
      ctx.engine.dismantleCard(ctx.caster, false, '강제 데이터 덤프', ctx.state?.cardUsageLog);
    }
    ctx.caster.shield = (ctx.caster.shield || 0) + handSize * multiplier;
  });

  // 스레드 동기화 — 최고/최저 코스트 카드 해체 후 코스트 합계 × n 피해
  registry.register('threadSync', (ctx) => {
    const hand = ctx.caster.hand;
    if (hand.length === 0) return;

    // 가장 높은 코스트 카드와 가장 낮은 코스트 카드 찾기
    let highIdx = 0, lowIdx = 0;
    for (let i = 1; i < hand.length; i++) {
      if (hand[i].cost > hand[highIdx].cost) highIdx = i;
      if (hand[i].cost < hand[lowIdx].cost) lowIdx = i;
    }

    const highCost = hand[highIdx].cost;
    const lowCost = hand[lowIdx].cost;
    const costSum = highCost + lowCost;
    const log = ctx.state?.cardUsageLog;

    // 높은 인덱스부터 제거해야 낮은 인덱스가 밀리지 않음
    if (highIdx !== lowIdx) {
      const first = Math.max(highIdx, lowIdx);
      const second = Math.min(highIdx, lowIdx);
      ctx.engine.dismantleCardAt(ctx.caster, first, '스레드 동기화', log);
      ctx.engine.dismantleCardAt(ctx.caster, second, '스레드 동기화', log);
    } else {
      ctx.engine.dismantleCardAt(ctx.caster, highIdx, '스레드 동기화', log);
    }

    // 코스트 합계 × n 피해
    const n = ctx.caster.networkStacks || 0;
    const dmg = costSum * n;
    if (dmg > 0) {
      ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
    }
  });

  // 방어도 무시 (플래그 설정 - 다음 데미지 이펙트에서 참조)
  registry.register('armorPierce', (ctx) => {
    ctx._armorPierce = true;
  });

  // 프로토콜 우회 (다음 N장 프로토콜 자동 충족)
  registry.register('protocolBypass', (ctx) => {
    ctx.caster.protocolBypassCount = (ctx.caster.protocolBypassCount || 0) + ctx.effect.value;
  });

  // ─── 러시안 룰렛 전용 이펙트 ───
  // 도박 핵심 메커니즘
  registry.register('gamble', (ctx) => {
    let chance = ctx.effect.chance !== undefined ? ctx.effect.chance : 50;
    ctx.caster.gambleChanceSumThisTurn = (ctx.caster.gambleChanceSumThisTurn || 0) + chance;
    const bonus = (ctx.caster.luck || 0) + (ctx.caster.gambleBonusChance || 0);
    chance += bonus;
    const rolled = Math.random() * 100;
    const success = rolled < chance;
    if (success) {
      if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `[도박성공] ${chance}% (Roll: ${rolled.toFixed(1)})` });
      ctx.caster.luckyThisTurn = (ctx.caster.luckyThisTurn || 0) + 1;
      ctx.caster.luckyThisBattle = (ctx.caster.luckyThisBattle || 0) + 1;
      ctx.caster.consecutiveLuck = (ctx.caster.consecutiveLuck || 0) + 1;
      // 운명의 룰렛 지배자(40번 파워)
      if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'rouletteMaster')) {
        gainLuck(ctx.caster, 2, ctx.state?.cardUsageLog);
        if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `룰렛 지배자: 행운 발생으로 행운 스택 +2` });
      }
      // 포춘 테이블(30번 파워): 행운 시 33% 확률로 드로우
      if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'drawOnLuckyChance')) {
        if (Math.random() < 0.33 && ctx.engine) {
          ctx.engine.drawCard(ctx.caster);
          if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `포춘 테이블: 행운 발동 → 카드 1장 드로우` });
        }
      }
      // 럭키 세븐(20번 파워): 매 턴 첫 행운 시 행운 스택 +1, 에너지 +1
      if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'energyOnFirstLuck')) {
        if (ctx.caster.luckyThisTurn === 1) {
          gainLuck(ctx.caster, 1, ctx.state?.cardUsageLog);
          ctx.caster.energy = (ctx.caster.energy || 0) + 1;
          if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `럭키 세븐: 첫 행운 → 행운 스택 +1, 에너지 +1` });
        }
      }
      if (ctx.effect.thenEffects) {
        for (const eff of ctx.effect.thenEffects) registry.execute(eff.type, { ...ctx, effect: eff });
      }
    } else {
      if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `[도박실패] ${chance}% (Roll: ${rolled.toFixed(1)})` });
      ctx.caster.unluckyThisTurn = (ctx.caster.unluckyThisTurn || 0) + 1;
      ctx.caster.unluckyThisBattle = (ctx.caster.unluckyThisBattle || 0) + 1;
      ctx.caster.consecutiveLuck = 0;
      // 운명의 룰렛 지배자(40번 파워)
      if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'rouletteMaster')) {
        const cost = ctx.card?.cost || 0;
        gainLuck(ctx.caster, cost, ctx.state?.cardUsageLog);
        if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `룰렛 지배자: 불운 카드 코스트(${cost})만큼 행운 획득` });
      }
      if (!ctx.caster.ignoreUnluck && ctx.effect.elseEffects) {
        for (const eff of ctx.effect.elseEffects) registry.execute(eff.type, { ...ctx, effect: eff });
      }
      // 운수 좋은 날(25번 스킬): 불운 시 해당 도박 카드 한 번 재시전 (무한루프 방지: _isRetry)
      if (ctx.caster.retryOnUnluck && !ctx._isRetry) {
        if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `운수 좋은 날: 불운 발생 → 재시전` });
        registry.execute('gamble', { ...ctx, _isRetry: true });
      }
    }
  });

  // 러시안 룰렛 반복 도박 (최대 shots회, 각 회마다 생존 or 총알)
  registry.register('russianRoulette', (ctx) => {
    const maxShots = ctx.effect.shots || 6;
    const bulletChance = ctx.effect.bulletChance || 16; // 총알 맞을 확률 (불운)
    const dmg = ctx.effect.damage || 25;
    const surviveBase = 100 - bulletChance; // 기본 생존 확률

    for (let i = 0; i < maxShots; i++) {
      const bonus = (ctx.caster.luck || 0) + (ctx.caster.gambleBonusChance || 0);
      const surviveChance = surviveBase + bonus;
      const rolled = Math.random() * 100;
      ctx.caster.gambleChanceSumThisTurn = (ctx.caster.gambleChanceSumThisTurn || 0) + surviveBase;

      if (rolled < surviveChance) {
        // 행운: 생존 + 피해
        ctx.caster.luckyThisTurn = (ctx.caster.luckyThisTurn || 0) + 1;
        ctx.caster.luckyThisBattle = (ctx.caster.luckyThisBattle || 0) + 1;
        ctx.caster.consecutiveLuck = (ctx.caster.consecutiveLuck || 0) + 1;
        if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `[룰렛 ${i + 1}발] 생존! ${dmg} 피해 (Roll: ${rolled.toFixed(1)} / 생존: ${surviveChance.toFixed(1)}%)` });
        // 운명의 룰렛 지배자(40번 파워)
        if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'rouletteMaster')) {
          gainLuck(ctx.caster, 2, ctx.state?.cardUsageLog);
          if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `룰렛 지배자: 행운 발생으로 행운 스택 +2` });
        }
        // 포춘 테이블(30번 파워): 행운 시 33% 확률로 드로우
        if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'drawOnLuckyChance')) {
          if (Math.random() < 0.33 && ctx.engine) {
            ctx.engine.drawCard(ctx.caster);
            if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `포춘 테이블: 행운 발동 → 카드 1장 드로우` });
          }
        }
        // 럭키 세븐(20번 파워): 매 턴 첫 행운 시 행운 스택 +1, 에너지 +1
        if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'energyOnFirstLuck')) {
          if (ctx.caster.luckyThisTurn === 1) {
            gainLuck(ctx.caster, 1, ctx.state?.cardUsageLog);
            ctx.caster.energy = (ctx.caster.energy || 0) + 1;
            if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `럭키 세븐: 첫 행운 → 행운 스택 +1, 에너지 +1` });
          }
        }
        if (ctx.engine) ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
      } else {
        // 불운: 총알 맞음 → 체력 절반 소실 후 중단
        ctx.caster.unluckyThisTurn = (ctx.caster.unluckyThisTurn || 0) + 1;
        ctx.caster.unluckyThisBattle = (ctx.caster.unluckyThisBattle || 0) + 1;
        ctx.caster.consecutiveLuck = 0;
        if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `[룰렛 ${i + 1}발] 총알 맞음! 체력 절반 소실 (Roll: ${rolled.toFixed(1)} / 생존: ${surviveChance.toFixed(1)}%)` });
        if (ctx.caster.activePowers?.some(pw => pw.powerEffect?.type === 'rouletteMaster')) {
          const cost = ctx.card?.cost || 0;
          gainLuck(ctx.caster, cost, ctx.state?.cardUsageLog);
          if (ctx.state?.cardUsageLog) ctx.state.cardUsageLog.push({ type: 'info', msg: `룰렛 지배자: 불운 카드 코스트(${cost})만큼 행운 획득` });
        }
        if (!ctx.caster.ignoreUnluck) {
          ctx.caster.hp = Math.max(1, Math.floor(ctx.caster.hp * 0.5));
        }
        break;
      }
    }
  });

  // 확률론의 지배자: 행운 획득 시 힘도 동량 증가하는 헬퍼
  const gainLuck = (caster, amount, log) => {
    caster.luck = (caster.luck || 0) + amount;
    if (amount > 0 && caster.activePowers?.some(pw => pw.powerEffect?.type === 'strengthPerLuck')) {
      caster.strength = (caster.strength || 0) + amount;
      if (log) log.push({ type: 'info', msg: `확률론의 지배자: 행운 +${amount} → 힘 +${amount}` });
    }
  };

  // 행운 스택 추가
  registry.register('addLuck', (ctx) => { gainLuck(ctx.caster, ctx.effect.value, ctx.state?.cardUsageLog); });
  registry.register('doubleLuck', (ctx) => {
    const gain = ctx.caster.luck || 0;
    gainLuck(ctx.caster, gain, ctx.state?.cardUsageLog);
  });
  registry.register('loseAllLuck', (ctx) => { ctx.caster.luck = 0; });
  // 주사위 굴려서 행운 스택 획득 (1~6)
  registry.register('diceRollLuck', (ctx) => {
    const roll = Math.floor(Math.random() * 6) + 1;
    gainLuck(ctx.caster, roll, ctx.state?.cardUsageLog);
  });

  // 카드를 손패로 되돌리고 코스트 0
  registry.register('returnToHandZeroCost', (ctx) => {
    if (ctx.caster.void?.length > 0) { const c = ctx.caster.void.pop(); c.cost = 0; ctx.caster.hand.push(c); }
  });

  // 무작위 카드 버림
  registry.register('discardRandom', (ctx) => {
    if (ctx.caster.hand?.length > 0) ctx.caster.void.push(ctx.caster.hand.splice(Math.floor(Math.random() * ctx.caster.hand.length), 1)[0]);
  });

  // 이번 턴 도박 확률 보너스
  registry.register('gambleChanceBuffThisTurn', (ctx) => { ctx.caster.gambleBonusChance = (ctx.caster.gambleBonusChance || 0) + ctx.effect.value; });

  // 주사위 콤보 (1~6 방어+공격)
  registry.register('diceRollCombo', (ctx) => {
    const roll = Math.floor(Math.random() * 6) + 1;
    ctx.caster.shield = (ctx.caster.shield || 0) + roll;
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, roll, ctx.caster);
  });

  // 마지막으로 드로우한 카드의 코스트 조정 (범용)
  registry.register('adjustCostLastDrawn', (ctx) => {
    if (ctx.caster.hand && ctx.caster.hand.length > 0) {
      const lastCard = ctx.caster.hand[ctx.caster.hand.length - 1];
      if (ctx.effect.set !== undefined) {
        lastCard.cost = ctx.effect.set;
      } else if (ctx.effect.add !== undefined) {
        lastCard.cost = Math.max(0, (lastCard.cost || 0) + ctx.effect.add);
      }
    }
  });

  // 데미지 감소(불운 시 데미지 줄임) — value: 기준 데미지, scale: 배율(기본 0.5)
  registry.register('damageNegative', (ctx) => {
    const value = ctx.effect.value || 0;
    const scale = ctx.effect.scale !== undefined ? ctx.effect.scale : 0.5;
    const reduced = Math.floor(value * scale);
    if (ctx.engine && reduced > 0) ctx.engine.applyDamage(ctx.target, reduced, ctx.caster);
  });

  // 불운 경험 시 추가 데미지
  registry.register('damageIfUnluckyThisTurn', (ctx) => {
    if (ctx.caster.unluckyThisTurn > 0 && ctx.engine) ctx.engine.applyDamage(ctx.target, ctx.effect.value, ctx.caster);
  });

  // 보험 가입
  registry.register('buffInsurance', (ctx) => {
    ctx.caster._insuranceActive = true;
  });

  // 턴 종료 시 자해
  registry.register('selfDamageAtTurnEnd', (ctx) => {
    applySelfDamage(ctx.caster, ctx.effect.value);
  });

  // 다음 도박 확률 증가
  registry.register('nextGambleBonusChance', (ctx) => { ctx.caster.gambleBonusChance = (ctx.caster.gambleBonusChance || 0) + ctx.effect.value; });

  // 패 전부 버림
  registry.register('discardAll', (ctx) => {
    while (ctx.caster.hand.length > 0) ctx.caster.void.push(ctx.caster.hand.pop());
  });

  // 체력 비율 회복
  registry.register('healScale', (ctx) => {
    const amt = Math.floor(ctx.caster.maxHp * ctx.effect.value);
    ctx.caster.hp = Math.min(ctx.caster.maxHp, ctx.caster.hp + amt);
  });

  // HP의 N%만큼 방어도 획득 (패킷 가로채기)
  registry.register('shieldByHpPercent', (ctx) => {
    const amt = Math.floor(ctx.caster.maxHp * (ctx.effect.value / 100));
    ctx.caster.shield = (ctx.caster.shield || 0) + amt;
  });

  // 손패의 모든 [네트워크] 카드 해체 후 해체 수만큼 드로우 (클라우드 덤프)
  registry.register('dismantleNetworkAndDraw', (ctx) => {
    const hand = ctx.caster.hand;
    const log = ctx.state?.cardUsageLog;
    // 뒤에서부터 제거해 인덱스 밀림 방지
    let dismantleCount = 0;
    for (let i = hand.length - 1; i >= 0; i--) {
      if (hand[i].keywords?.includes('network')) {
        ctx.engine.dismantleCardAt(ctx.caster, i, '클라우드 덤프', log);
        dismantleCount++;
      }
    }
    if (dismantleCount > 0 && ctx.engine) {
      ctx.engine._drawCards(ctx.caster, dismantleCount, '클라우드 덤프', log);
    }
  });

  // 손패 전부 버리고 덱에서 고코스트 순으로 N장 뽑아 코스트 1로 설정 (마스터 오버라이드)
  registry.register('masterOverride', (ctx) => {
    const hand = ctx.caster.hand;
    const log = ctx.state?.cardUsageLog;
    const discardCount = hand.length;
    // 손패 전체를 void로
    for (let i = hand.length - 1; i >= 0; i--) {
      const c = hand.splice(i, 1)[0];
      ctx.caster.void = ctx.caster.void || [];
      ctx.caster.void.push(c);
    }
    if (log) log.push({ type: 'effect', source: '마스터 오버라이드', effect: `손패 ${discardCount}장 버림` });
    // 덱에서 고코스트 순으로 정렬 후 N장 뽑기
    const drawPile = ctx.caster.drawPile;
    if (!drawPile || drawPile.length === 0 || discardCount === 0) return;
    drawPile.sort((a, b) => (b.cost || 0) - (a.cost || 0));
    const toDraw = Math.min(discardCount, drawPile.length);
    for (let i = 0; i < toDraw; i++) {
      const c = drawPile.shift();
      c.cost = 1;
      ctx.caster.hand.push(c);
    }
    if (log) log.push({ type: 'effect', source: '마스터 오버라이드', effect: `고코스트 카드 ${toDraw}장 서치, 코스트 1 적용` });
  });

  // 턴 종료 (forceEndTurn 플래그 → 엔진 while 루프에서 감지)
  registry.register('endTurn', (ctx) => {
    ctx.caster.forceEndTurn = true;
  });

  // 남은 에너지당 카드 1장 드로우
  registry.register('drawPerEnergy', (ctx) => {
    const remaining = ctx.caster.energy || 0;
    if (remaining > 0 && ctx.engine) {
      ctx.engine._drawCards(ctx.caster, remaining, '매크로 캔슬', ctx.state?.cardUsageLog);
    }
  });

  // 에너지 전량 소모 (0으로 만들기)
  registry.register('drainEnergy', (ctx) => {
    ctx.caster.energy = 0;
  });

  // 에너지를 현재 최대치(baseEnergy)로 완전 회복
  registry.register('restoreMaxEnergy', (ctx) => {
    ctx.caster.energy = ctx.caster.baseEnergy || 3;
  });

  // 에너지 전환 (에너지 소모 후 체력 회복)
  registry.register('energyToHeal', (ctx) => {
    const energy = ctx.caster.energy || 0;
    if (energy > 0) {
      const healAmount = energy * (ctx.effect.multiplier || 10);
      ctx.caster.energy = 0;
      ctx.caster.hp = Math.min(ctx.caster.hp + healAmount, ctx.caster.maxHp);
    }
  });

  // 방어도를 에너지로 전환 (최대 100 소모, 10당 1 에너지)
  registry.register('shieldToEnergy', (ctx) => {
    const currentShield = ctx.caster.shield || 0;
    const toConsume = Math.min(currentShield, 100);
    if (toConsume >= 10) {
      const energyGain = Math.floor(toConsume / 10);
      ctx.caster.shield -= toConsume;
      ctx.caster.energy = Math.min((ctx.caster.energy || 0) + energyGain, ctx.caster.maxEnergyPool || 10);
      if (ctx.state?.cardUsageLog) {
        ctx.state.cardUsageLog.push({ type: 'effect', source: '동력 전환', effect: `방어도 ${toConsume} 소모 → 에너지 ${energyGain} 획득` });
      }
    }
  });

  // 방어도 훔침 통합 핸들러
  //   mode: 'all'       — 적 방어도 전부 훔침 (내가 획득)
  //   mode: 'half'      — 적 방어도 절반 제거 (내가 얻지 않음)
  //   mode: 'halfSteal' — 적 방어도 50% 제거 + 내가 획득
  //   mode: 'value'     — value만큼 훔침 (기본값, mode 생략 가능)
  //   gain: false       — 제거만 하고 내가 얻지 않음
  registry.register('stealShield', (ctx) => {
    const mode = ctx.effect.mode || 'value';
    const targetShield = ctx.target.shield || 0;
    let amt = 0;

    if (mode === 'all') {
      amt = targetShield;
      ctx.target.shield = 0;
    } else if (mode === 'half') {
      amt = Math.floor(targetShield / 2);
      ctx.target.shield -= amt;
    } else if (mode === 'halfSteal') {
      amt = Math.floor(targetShield / 2);
      ctx.target.shield -= amt;
      ctx.caster.shield = (ctx.caster.shield || 0) + amt;
      return;
    } else {
      amt = Math.min(targetShield, ctx.effect.value || 0);
      ctx.target.shield -= amt;
    }

    if (ctx.effect.gain !== false && mode !== 'half') {
      ctx.caster.shield = (ctx.caster.shield || 0) + amt;
    }
  });

  // 하위 호환 alias
  registry.register('stealShieldAll', (ctx) => registry.execute('stealShield', { ...ctx, effect: { ...ctx.effect, mode: 'all' } }));
  registry.register('stealShieldHalfAndLose', (ctx) => registry.execute('stealShield', { ...ctx, effect: { ...ctx.effect, mode: 'half' } }));

  // 적 방어도만큼 자해
  registry.register('selfDamageByTargetShield', (ctx) => {
    const dmg = ctx.target.shield || 0;
    if (dmg > 0) applySelfDamage(ctx.caster, dmg);
  });

  // 턴 종료 시 무작위 카드 N장 버리기 (지연 등록)
  registry.register('addEndOfTurnDiscard', (ctx) => {
    ctx.caster.pendingEndOfTurnDiscards = (ctx.caster.pendingEndOfTurnDiscards || 0) + (ctx.effect.value || 1);
  });

  // 풀하우스 난타 (5회 타격)
  registry.register('fullHouseHit', (ctx) => {
    for (let i = 0; i < 5; i++) {
      let dmg = 6;
      if (Math.random() * 100 < 50 + (ctx.caster.luck || 0) + (ctx.caster.gambleBonusChance || 0)) {
        dmg *= 2; ctx.caster.luckyThisTurn = (ctx.caster.luckyThisTurn || 0) + 1;
      } else {
        ctx.caster.unluckyThisTurn = (ctx.caster.unluckyThisTurn || 0) + 1; ctx.caster.consecutiveLuck = 0;
      }
      if (ctx.engine) ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
    }
  });

  // 행운 스택 기반 데미지
  registry.register('damageByLuckStack', (ctx) => {
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, (ctx.caster.luck || 0) * ctx.effect.multiplier, ctx.caster);
  });

  // 적 최대 체력 비율 데미지
  registry.register('damageMaxPercent', (ctx) => {
    let dmg = Math.floor(ctx.target.maxHp * ctx.effect.value);
    if (dmg > ctx.effect.limit) dmg = ctx.effect.limit;
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
  });

  // 불운 횟수 기반 추가 데미지
  registry.register('damagePlusByUnluckyThisBattle', (ctx) => {
    const extra = (ctx.caster.unluckyThisBattle || 0) * ctx.effect.multiplier;
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, extra, ctx.caster);
  });

  // 행운 횟수 기반 추가 데미지
  registry.register('damagePlusByLuckyThisBattle', (ctx) => {
    const extra = (ctx.caster.luckyThisBattle || 0) * ctx.effect.multiplier;
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, extra, ctx.caster);
  });

  // 이번 턴 불운 무시
  registry.register('ignoreUnluckThisTurn', (ctx) => { ctx.caster.ignoreUnluck = true; });

  // 이번 턴 도박 불운 시 재시전
  registry.register('retryGambleOnUnluck', (ctx) => { ctx.caster.retryOnUnluck = true; });

  // 덱 위 카드 버리고 코스트만큼 쉴드
  registry.register('discardTopAndGainShieldByCost', (ctx) => {
    if (ctx.caster.deck?.length > 0) {
      const c = ctx.caster.deck.splice(0, 1)[0];
      ctx.caster.void.push(c);
      ctx.caster.shield = (ctx.caster.shield || 0) + (c.cost || 0);
    }
  });

  // 손패+덱을 합쳐 섞고 N장 뽑기
  registry.register('reshuffleAndDraw', (ctx) => {
    while (ctx.caster.hand.length > 0) ctx.caster.void.push(ctx.caster.hand.pop());
    for (let i = 0; i < ctx.effect.value; i++) { if (ctx.engine) ctx.engine.drawCard(ctx.caster, 'Reshuffle'); }
  });

  // selfWeakness — 자신에게 약화 부여
  registry.register('selfWeakness', (ctx) => { ctx.caster.weakness = (ctx.caster.weakness || 0) + ctx.effect.value; });

  // 무작위 버프
  registry.register('randomBuff', (ctx) => {
    const r = Math.random();
    if (r < 0.25) ctx.caster.strength = (ctx.caster.strength || 0) + 5;
    else if (r < 0.5) ctx.caster.shield = (ctx.caster.shield || 0) + 20;
    else if (r < 0.75) ctx.caster.energy = (ctx.caster.energy || 0) + 2;
    else { for (let i = 0; i < 3; i++) if (ctx.engine) ctx.engine.drawCard(ctx.caster, 'Random Buff'); }
  });

  // 카지노 로얄 필드 리셋
  registry.register('casinoRoyalFieldReset', (ctx) => {
    ctx.caster.shield = 0; ctx.target.shield = 0;
    ctx.caster.strength = 0; ctx.target.strength = 0;
    ctx.caster.weakness = 0; ctx.target.weakness = 0;
    ctx.caster.virus = 0; ctx.target.virus = 0;
    ctx.caster.corrosion = 0; ctx.target.corrosion = 0;
    ctx.caster.hp = Math.min(ctx.caster.maxHp, Math.floor(ctx.caster.maxHp * 0.5));
    ctx.target.hp = Math.min(ctx.target.maxHp, Math.floor(ctx.target.maxHp * 0.5));
  });

  // 체력 비율 설정
  registry.register('setHpScale', (ctx) => { ctx.caster.hp = Math.max(1, Math.floor(ctx.caster.hp * ctx.effect.value) || 1); });
  registry.register('setEnemyHpScale', (ctx) => { ctx.target.hp = Math.max(1, Math.floor(ctx.target.hp * ctx.effect.value) || 1); });

  // 데스 크로스 (체력차 절댓값 도박)
  registry.register('gambleDeathCross', (ctx) => {
    const diff = Math.abs(ctx.caster.hp - ctx.target.hp);
    const chance = 30 + (ctx.caster.luck || 0) + (ctx.caster.gambleBonusChance || 0);
    if (Math.random() * 100 < chance) {
      ctx.caster.luckyThisTurn = (ctx.caster.luckyThisTurn || 0) + 1;
      ctx.caster.consecutiveLuck = (ctx.caster.consecutiveLuck || 0) + 1;
      if (ctx.engine) ctx.engine.applyDamage(ctx.target, diff * 2, ctx.caster);
    } else {
      ctx.caster.unluckyThisTurn = (ctx.caster.unluckyThisTurn || 0) + 1;
      ctx.caster.consecutiveLuck = 0;
      if (ctx.engine) ctx.engine.applyDamage(ctx.caster, diff, ctx.target);
    }
  });

  // 이번 턴 누적 행운 체크 데미지 (이번 턴 성공 required회 이상 시 scale배)
  registry.register('damageIfConsecutiveLuck', (ctx) => {
    const str = (ctx.caster.strength || 0);
    const weak = (ctx.caster.weakness || 0);
    let d = ctx.effect.base + str - weak;
    const consecutive = (ctx.caster.luckyThisTurn || 0) >= ctx.effect.required;
    if (consecutive) d = Math.floor((ctx.effect.base + str - weak) * (ctx.effect.scale || 1));
    if (ctx._dmgFlags) ctx._dmgFlags.strengthApplied = true;
    if (ctx.engine) ctx.engine.applyDamage(ctx.target, Math.max(1, d), ctx.caster);
  });

  // 동전의 양면 - 앞면(잃은 체력만큼 방어도)
  registry.register('coinFlipHeads', (ctx) => {
    const lost = Math.floor(ctx.caster.maxHp * 0.5);
    ctx.caster.shield = (ctx.caster.shield || 0) + lost;
  });

  // 도박빚 탕감 계약
  registry.register('gambleDebt', (ctx) => {
    ctx.caster.hand.forEach(c => {
      if (c.keywords?.includes('gamble')) { c._oldCost = c._oldCost !== undefined ? c._oldCost : c.cost; c.cost = 0; }
    });
  });
}

