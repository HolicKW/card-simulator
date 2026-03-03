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

  // ─── 기본 이펙트 ───
  registry.register('damage', (ctx) => {
    let dmg = ctx.effect.value;
    // 힘(Strength) 적용
    dmg += (ctx.caster.strength || 0);
    // 다단히트 밸런싱 캡: hits > 1이면 힘 반감
    if (ctx.effect.hits && ctx.effect.hits > 1) {
      dmg = ctx.effect.value + Math.floor((ctx.caster.strength || 0) / 2);
    }
    // 약화 적용 (최소 1)
    dmg -= (ctx.target.weakness || 0);
    if (dmg < 1) dmg = 1;

    const hits = ctx.effect.hits || 1;
    for (let i = 0; i < hits; i++) {
      ctx.engine.applyDamage(ctx.target, dmg);
    }
  });

  registry.register('shield', (ctx) => {
    ctx.caster.shield = (ctx.caster.shield || 0) + ctx.effect.value;
  });

  registry.register('heal', (ctx) => {
    const amount = ctx.effect.value;
    ctx.caster.hp = Math.min(ctx.caster.hp + amount, ctx.caster.maxHp);
  });

  registry.register('draw', (ctx) => {
    for (let i = 0; i < ctx.effect.value; i++) {
      ctx.engine.drawCard(ctx.caster);
    }
  });

  registry.register('energy', (ctx) => {
    ctx.caster.energy = (ctx.caster.energy || 0) + ctx.effect.value;
  });

  registry.register('shieldBreak', (ctx) => {
    const amount = ctx.effect.value;
    ctx.target.shield = Math.max(0, (ctx.target.shield || 0) - amount);
  });

  // ─── 상태이상 ───
  registry.register('strength', (ctx) => {
    ctx.caster.strength = (ctx.caster.strength || 0) + ctx.effect.value;
  });

  registry.register('weakness', (ctx) => {
    ctx.target.weakness = (ctx.target.weakness || 0) + ctx.effect.value;
  });

  // ─── 자해 ───
  registry.register('selfDamage', (ctx) => {
    const dmg = ctx.effect.value;
    ctx.caster.hp -= dmg;
    ctx.caster.selfDamageThisTurn = (ctx.caster.selfDamageThisTurn || 0) + dmg;
    if (ctx.caster.hp < 0) ctx.caster.hp = 0;
  });

  // ─── 과부하 ───
  registry.register('overload', (ctx) => {
    ctx.caster.overloadNext = (ctx.caster.overloadNext || 0) + ctx.effect.value;
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
  });

  registry.register('overclockReduce', (ctx) => {
    ctx.caster.overclockStacks = Math.max(
      0, (ctx.caster.overclockStacks || 0) - ctx.effect.value
    );
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

  // ─── 해체 ───
  registry.register('dismantle', (ctx) => {
    const count = ctx.effect.value || 1;
    const random = ctx.effect.random !== false; // 기본 무작위
    for (let i = 0; i < count; i++) {
      ctx.engine.dismantleCard(ctx.caster, random);
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
    // 카드 사용 후 소멸 대신 핸드로 복귀, 재구축 카운트 감소
    // engine.playCard에서 처리
  });

  // ─── 최대체력 감소 ───
  registry.register('maxHpReduce', (ctx) => {
    ctx.caster.maxHp = Math.max(1, ctx.caster.maxHp - ctx.effect.value);
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
      case 'targetHpBelow':
        condMet = ctx.target.hp <= ctx.target.maxHp * (condition.value / 100);
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
    let base = ctx.effect.value || 0;
    const scaling = ctx.effect.scaling;

    switch (scaling.source) {
      case 'selfDamageThisTurn':
        base += (ctx.caster.selfDamageThisTurn || 0) * (scaling.multiplier || 1);
        break;
      case 'overclockConsumed':
        base += (ctx.overclockConsumed || 0) * (scaling.multiplier || 1);
        break;
      case 'dismantledThisBattle':
        base += (ctx.caster.dismantledThisBattle || 0) * (scaling.multiplier || 1);
        break;
      case 'overloadStacks':
        base += (ctx.caster.overloadNext || 0) * (scaling.multiplier || 1);
        break;
      case 'targetLostHp':
        const lost = ctx.target.maxHp - ctx.target.hp;
        base += Math.min(lost * (scaling.multiplier || 0.1), scaling.max || 999);
        break;
      default: break;
    }

    let dmg = base + (ctx.caster.strength || 0);
    dmg -= (ctx.target.weakness || 0);
    if (dmg < 1) dmg = 1;
    ctx.engine.applyDamage(ctx.target, dmg);
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
      default: break;
    }
    ctx.caster.shield = (ctx.caster.shield || 0) + base;
  });
}
