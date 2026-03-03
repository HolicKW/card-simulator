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
    // 네트워크 퍼마넌트 버프 적용
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkDamageBuff) {
      dmg += ctx.caster.networkDamageBuff;
    }
    // 약화 적용 (최소 1)
    dmg -= (ctx.target.weakness || 0);
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
      case 'networkCardsPlayed':
        condMet = (ctx.caster.networkCardsPlayedThisTurn || 0) >= condition.value;
        break;
      case 'cardsPlayedThisTurn':
        condMet = (ctx.caster.cardsPlayedThisTurn || 0) >= condition.value;
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
      case 'networkStacks':
        base += (ctx.caster.networkStacks || 0) * (scaling.multiplier || 1);
        break;
      case 'totalDamageThisTurn':
        base += (ctx.caster.totalDamageThisTurn || 0) * (scaling.multiplier || 1);
        break;
      default: break;
    }

    let dmg = base + (ctx.caster.strength || 0);
    // 네트워크 퍼마넌트 버프
    if (ctx.card?.keywords?.includes('network') && ctx.caster.networkDamageBuff) {
      dmg += ctx.caster.networkDamageBuff;
    }
    dmg -= (ctx.target.weakness || 0);
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

  // 부식 디버프 (턴 시작시 방어도부터 깎는 DoT)
  registry.register('corrosion', (ctx) => {
    // 대상 지정인지, 자신인지 확인
    let target = ctx.target;
    if (ctx.effect.target === 'self') target = ctx.caster;
    target.corrosion = (target.corrosion || 0) + ctx.effect.value;
  });

  // 바이러스 소모 공통 처리 헬퍼를 효과 핸들러 내에서 직접 구현하거나,
  // 소모 후 특정 액션을 하는 복합 효과들을 등록합니다.

  // 1. 바이러스 소모 딜 (전이성 격발 등)
  registry.register('consumeVirusForDamage', (ctx) => {
    let virusCount = ctx.target.virus || 0;
    let consumeAmount = ctx.effect.consume === 'all' ? virusCount : Math.min(virusCount, ctx.effect.consume);

    // 부분 소모인데 조건량 미달이면 실패
    if (ctx.effect.consume !== 'all' && virusCount < ctx.effect.consume) {
      return; // 발동 불가
    }

    if (consumeAmount > 0) {
      ctx.target.virus -= consumeAmount;
      let dmg = consumeAmount * (ctx.effect.multiplier || 1);

      ctx.engine.applyDamage(ctx.target, dmg, ctx.caster, true); // true = 방어 뚫는/고정 피해 개념 (기획에 맞게 조정 가능. 엔진 applyDamage에서 true 추가 파라미터 필요)

      // 면역계 장악 パ워 / 생물학적 무기 금고 파워 체크
      ctx.engine._triggerVirusConsumePowers(ctx.caster, consumeAmount);

      // 팬데믹 스톰 부식 부여 연계
      if (ctx.effect.applyCorrosionRatio) {
        let corr = Math.floor(consumeAmount * ctx.effect.applyCorrosionRatio);
        if (corr > 0) ctx.target.corrosion = (ctx.target.corrosion || 0) + corr;
      }
    }
  });

  // 2. 바이러스 소모 드로우 / 에너지 / 힐 (유틸)
  registry.register('consumeVirusForUtility', (ctx) => {
    let virusCount = ctx.target.virus || 0;
    if (virusCount >= ctx.effect.consume) {
      ctx.target.virus -= ctx.effect.consume;

      if (ctx.effect.draw) ctx.engine._drawCards(ctx.caster, ctx.effect.draw);
      if (ctx.effect.energy) ctx.caster.energy = Math.min((ctx.caster.energy || 0) + ctx.effect.energy, ctx.caster.maxEnergyPool || 10);
      if (ctx.effect.shield) ctx.caster.shield = (ctx.caster.shield || 0) + ctx.effect.shield;
      if (ctx.effect.heal) ctx.engine.heal(ctx.caster, ctx.effect.heal);
      if (ctx.effect.strength) ctx.caster.strength = (ctx.caster.strength || 0) + ctx.effect.strength;

      ctx.engine._triggerVirusConsumePowers(ctx.caster, ctx.effect.consume);
    }
  });

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

  // 4. 용해성 맹독 전용 (방어 무시 피해가 삭제된 밸런스 패치 기준)
  registry.register('meltToxin', (ctx) => {
    if ((ctx.target.virus || 0) >= 8) {
      ctx.target.virus -= 8;
      ctx.target.weakness = (ctx.target.weakness || 0) + 2; // 약화 2
      ctx.target.corrosion = (ctx.target.corrosion || 0) + 3; // 부식 3
      ctx.engine._triggerVirusConsumePowers(ctx.caster, 8);
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
        let dmg = ctx.effect.addDamage + (ctx.caster.strength || 0) - (ctx.target.weakness || 0);
        if (dmg < 1) dmg = 1;
        ctx.engine.applyDamage(ctx.target, dmg, ctx.caster);
      }
      if (ctx.effect.addVirus) ctx.target.virus = (ctx.target.virus || 0) + ctx.effect.addVirus;
      if (ctx.effect.destroyShield) ctx.target.shield = 0;
      if (ctx.effect.setStrengthZero) ctx.target.strength = 0;
      if (ctx.effect.halveStrength) ctx.target.strength = Math.floor((ctx.target.strength || 0) / 2);
    }
  });

  // 6. 소모한 스택만큼 방어도 (변종 적응체 하향안)
  registry.register('consumeVirusForShieldScale', (ctx) => {
    let virusCount = ctx.target.virus || 0;
    let consume = Math.min(virusCount, ctx.effect.maxConsume || 15);
    if (consume > 0) {
      ctx.target.virus -= consume;
      ctx.caster.shield = (ctx.caster.shield || 0) + (consume * ctx.effect.multiplier);
      ctx.engine._triggerVirusConsumePowers(ctx.caster, consume);
    }
  });


  // 방어도 무시 (플래그 설정 - 다음 데미지 이펙트에서 참조)
  registry.register('armorPierce', (ctx) => {
    // armorPierce는 카드 레벨에서 프로토콜 효과로 처리됨
    // 여기서는 플래그만 설정
    ctx._armorPierce = true;
  });

  // 프로토콜 우회 (다음 N장 프로토콜 자동 충족)
  registry.register('protocolBypass', (ctx) => {
    ctx.caster.protocolBypassCount = (ctx.caster.protocolBypassCount || 0) + ctx.effect.value;
  });
}
