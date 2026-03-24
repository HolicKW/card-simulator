/**
 * cards.js — 카드 데이터베이스
 * 
 * 새 카드 추가 시: CARDS 배열에 객체를 push하면 자동으로 시뮬레이터에 반영.
 * 새 카드팩 추가 시: registerPack() 호출.
 * 
 * 카드 스키마:
 * {
 *   id: string,          // 고유 ID
 *   name: string,        // 카드 이름
 *   pack: string,        // 소속 팩 ('base' | 'overclock' | 'dismantle' | ...)
 *   type: string,        // 'attack' | 'skill' | 'power'
 *   rarity: string,      // 'common' | 'rare' | 'epic' | 'unique' | 'legendary'
 *   tier: number,        // 해금 티어 (1~5)
 *   cost: number,        // 코스트
 *   keywords: string[],  // 키워드 태그
 *   effects: Effect[],   // 이펙트 배열
 *   description: string, // 카드 설명
 *   rebuildCount?: number // 재구축 횟수 (재구축 키워드 카드)
 * }
 */

// ─── 카드 팩 레지스트리 ───
const PACKS = new Map();

export function registerPack(packId, packInfo) {
    PACKS.set(packId, packInfo);
}

export function getPack(packId) {
    return PACKS.get(packId);
}

export function getAllPacks() {
    return Array.from(PACKS.entries()).map(([id, info]) => ({ id, ...info }));
}

// ─── 전체 카드 DB ───
const ALL_CARDS = [];

export function registerCards(cards) {
    ALL_CARDS.push(...cards);
}

export function getCardById(id) {
    return ALL_CARDS.find(c => c.id === id);
}

export function getCardsByPack(packId) {
    return ALL_CARDS.filter(c => c.pack === packId);
}

export function getCardsByTier(tier) {
    return ALL_CARDS.filter(c => c.tier === tier);
}

export function getCardsByRarity(rarity) {
    return ALL_CARDS.filter(c => c.rarity === rarity);
}

export function getAllCards() {
    return [...ALL_CARDS];
}

// ─── 기본 공용 카드 (26장) ───
registerPack('base', {
    name: '기본 공용 카드',
    description: '어떤 팩을 고르든 해금되는 공통 베이스 카드군',
    totalCards: 40
});

registerCards([
    // === Tier 1 (10장) ===
    {
        id: 'BASE_001', name: '신속 타격', pack: 'base',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 6 }],
        description: '적에게 6의 피해를 줍니다.'
    },
    {
        id: 'BASE_002', name: '연속 타격', pack: 'base',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 3, hits: 2 }],
        description: '적에게 3의 피해를 2번 줍니다.'
    },
    {
        id: 'BASE_003', name: '견제 사격', pack: 'base',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 4 }, { type: 'weakness', value: 1 }],
        description: '적에게 4의 피해를 주고, 약화를 1 부여합니다.'
    },
    {
        id: 'BASE_004', name: '파쇄 타격', pack: 'base',
        type: 'attack', rarity: 'common', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'shieldBreak', value: 5 }, { type: 'damage', value: 12 }],
        description: '적의 방어도를 5 깎고, 12의 피해를 줍니다.'
    },
    {
        id: 'BASE_005', name: '전술 방패 전개', pack: 'base',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 6 }],
        description: '6의 방어도를 얻습니다.'
    },
    {
        id: 'BASE_006', name: '견고한 방어', pack: 'base',
        type: 'skill', rarity: 'common', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'shield', value: 14 }],
        description: '14의 방어도를 얻습니다.'
    },
    {
        id: 'BASE_007', name: '응급 치료 킷', pack: 'base',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'heal', value: 10 }],
        description: '내 체력을 10 회복합니다.'
    },
    {
        id: 'BASE_008', name: '회로 스캔', pack: 'base',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }],
        description: '카드를 1장 뽑습니다.'
    },
    {
        id: 'BASE_009', name: '예비 부품 탐색', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }],
        description: '카드를 2장 뽑습니다.'
    },
    {
        id: 'BASE_010', name: '약점 스캔', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'strength', value: 2 }, { type: 'draw', value: 1 }],
        description: '내게 힘을 2 부여하고 카드를 1장 뽑습니다.'
    },
    // === Tier 2 (8장) ===
    {
        id: 'BASE_011', name: '충격파 발생기', pack: 'base',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'damage', value: 12 }, { type: 'weakness', value: 2 }],
        description: '적에게 12의 피해를 주고, 약화를 2 부여합니다.'
    },
    {
        id: 'BASE_012', name: '전력 재분배', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'energyNextTurn', value: 2 }],
        description: '다음 턴 시작 시 에너지를 2 얻습니다.'
    },
    {
        id: 'BASE_013', name: '시야 교란 먼지', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'weakness', value: 2 }],
        description: '적에게 약화를 2 부여합니다.'
    },
    {
        id: 'BASE_014', name: '긴급 회피', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [],
        passiveEffect: { type: 'discardSelfToHalveDamage' },
        description: '손패에 있는 동안 피해를 받으면 이 카드를 자동 해체하고 피해를 반감합니다.'
    },
    {
        id: 'BASE_015', name: '전면 방어 전개', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'shield', value: 21 }],
        description: '21의 방어도를 얻습니다.'
    },
    {
        id: 'BASE_016', name: '재장전', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: false }, { type: 'draw', value: 2 }],
        description: '카드 1장 해체, 카드 2장 드로우.'
    },
    {
        id: 'BASE_017', name: '연막탄 투척', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 8 }, { type: 'weakness', value: 1 }],
        description: '방어도 8, 적에게 약화 1.'
    },
    {
        id: 'BASE_018', name: '전투 자극제', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 0,
        keywords: [],
        effects: [{ type: 'strength', value: 5 }, { type: 'draw', value: 1 }],
        description: '이번 턴 힘 5, 카드 1장 드로우.'
    },
    // === Tier 3 (8장) ===
    {
        id: 'BASE_019', name: '무차별 난사', pack: 'base',
        type: 'attack', rarity: 'rare', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'damage', value: 5, hits: 4 }],
        description: '적에게 5의 피해를 4번 줍니다.'
    },
    {
        id: 'BASE_020', name: '압도적 제압', pack: 'base',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [
            { type: 'damage', value: 20 },
            { type: 'conditional', condition: { type: 'enemyHasWeakness' }, thenEffects: [{ type: 'draw', value: 1 }], elseEffects: [] }
        ],
        description: '적에게 20 피해. 적에게 약화 있으면 1장 드로우.'
    },
    {
        id: 'BASE_021', name: '시스템 정화', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'heal', value: 15 }],
        description: '체력을 15 회복합니다.'
    },
    {
        id: 'BASE_022', name: '생존 본능', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: [],
        effects: [{
            type: 'conditional',
            condition: { type: 'hpBelow', value: 30 },
            thenEffects: [{ type: 'shield', value: 24 }],
            elseEffects: [{ type: 'shield', value: 10 }]
        }],
        description: '방어도 10. 체력 30% 이하면 방어도 24.'
    },
    {
        id: 'BASE_023', name: '전술적 후퇴', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'scaledShield', value: 0, scaling: { source: 'nonBaseCardInHand', multiplier: 4 } }, { type: 'draw', value: 1 }],
        description: '패의 비공용 카드 1장당 방어도 4, 카드 1장 드로우.'
    },
    {
        id: 'BASE_024', name: '나노 봇 스웜', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'heal', value: 20 }, { type: 'shield', value: 25 }],
        description: '체력 20 회복, 방어도 25 획득.'
    },
    {
        id: 'BASE_025', name: '동력 전환', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'energyFromShield', multiplier: 0.1 }],
        description: '방어도를 모두 잃고, 잃은 방어도 10당 에너지 1.'
    },
    {
        id: 'BASE_026', name: '반격 태세', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 8 }, { type: 'nextTurnShield', value: 5 }],
        description: '방어도 8 + 다음 턴 시작 시 방어도 5.'
    },
    // === Tier 4 (7장) ===
    {
        id: 'BASE_027', name: '결정적 일격', pack: 'base',
        type: 'attack', rarity: 'epic', tier: 4, cost: 3,
        keywords: [],
        effects: [{ type: 'damage', value: 60 }],
        description: '적에게 60의 피해. 적 체력 50% 이하면 코스트 1.'
    },
    {
        id: 'BASE_028', name: '방어막 파쇄기', pack: 'base',
        type: 'attack', rarity: 'epic', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'shieldBreakAllAndDamage', fraction: 0.5 }],
        description: '적의 방어도를 모두 파괴합니다. 파괴한 방어도의 절반만큼 피해를 입힙니다.'
    },
    {
        id: 'BASE_029', name: '중장갑 기동', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 15 }, { type: 'nextAttackBonus', value: 10 }],
        description: '15의 방어도 + 다음 공격 피해 10 증가.'
    },
    {
        id: 'BASE_030', name: '에너지 전환', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 0,
        keywords: [],
        effects: [{ type: 'energyToHeal', multiplier: 10 }],
        description: '내 에너지를 모두 소모합니다. 소모한 에너지 x 10만큼 체력을 회복합니다.'
    },
    {
        id: 'BASE_031', name: '비상 동력원', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 0,
        keywords: [],
        effects: [{ type: 'energy', value: 2 }],
        description: '이번 턴에 에너지를 2 얻습니다.'
    },
    {
        id: 'BASE_032', name: '초과 충전 프로토콜', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantleForEnergy' }],
        description: '손패에서 카드 1장 선택 해체. 해체한 카드의 본래 비용만큼 에너지를 얻고 카드를 1장 드로우.'
    },
    {
        id: 'BASE_033', name: '강화 외골격', pack: 'base',
        type: 'power', rarity: 'epic', tier: 4, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraDebuffReduction', value: 1, shield: 15 },
        description: '매 턴 방어도 15 + 디버프 감소 강화.'
    },
    // === Tier 5 (7장) ===
    {
        id: 'BASE_034', name: '궤도 폭격', pack: 'base',
        type: 'attack', rarity: 'unique', tier: 5, cost: 4,
        keywords: [],
        effects: [{ type: 'damage', value: 80 }, { type: 'damageIfHandEmpty', value: 120, cost: 1 }],
        description: '적에게 80 피해. 손에 다른 카드가 없으면 코스트 1, 120 피해.'
    },
    {
        id: 'BASE_035', name: '만능 조커 패스', pack: 'base',
        type: 'skill', rarity: 'unique', tier: 5, cost: 0,
        keywords: [],
        effects: [{ type: 'drawAndZeroCost', value: 2 }],
        description: '카드 2장 드로우 및 이번 턴 0코스트.'
    },
    {
        id: 'BASE_036', name: '광역 전술 지시', pack: 'base',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [{ type: 'costReduceAttackCards' }, { type: 'draw', value: 3 }],
        description: '손패의 모든 [공격] 카드 코스트를 1 감소(최소 0). 카드 3장 드로우.'
    },
    {
        id: 'BASE_037', name: '전술 지휘 체계', pack: 'base',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraDraw', value: 1 },
        description: '매 턴 드로우 +1.'
    },
    {
        id: 'BASE_038', name: '아드레날린 펌프', pack: 'base',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraEnergy', value: 1 },
        description: '매 턴 에너지 +1.'
    },
    {
        id: 'BASE_039', name: '한계 돌파 훈련', pack: 'base',
        type: 'power', rarity: 'unique', tier: 5, cost: 3,
        keywords: [],
        effects: [],
        powerEffect: { type: 'strengthOnManyCards', threshold: 3, value: 1 },
        description: '한 턴에 카드 3장 이상 사용 시 힘 +1.'
    },
    {
        id: 'BASE_040', name: '이중 캐스팅 코어', pack: 'base',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: [],
        effects: [],
        powerEffect: { type: 'doubleFirstSkill' },
        description: '매 턴 최초 스킬 카드가 한 번 더 발동.'
    }
]);

// ─── 오버클럭 코어 팩 (40장) ───
registerPack('overclock', {
    name: '오버클럭 코어 팩',
    description: '자해, 과부하, 딜 펌핑 설계. 오버클럭 스택으로 화력 극대화.',
    totalCards: 40
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'OC_001', name: '피를 머금은 톱니', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'scaledSelfDamage', value: 4, scaling: { source: 'overclockStacks', multiplier: 4 } }, { type: 'scaledDamage', value: 6, scaling: { source: 'overclockStacks', multiplier: 6 } }],
        description: '오버클럭: 자해 4+(스택×4), 적에게 6+(스택×6) 피해.'
    },
    {
        id: 'OC_002', name: '우회 타격', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock', 'dismantle'],
        playCondition: { type: 'handSizeMin', value: 1, overclockScale: true },
        effects: [{ type: 'dismantle', value: 1, random: true, overclockScale: true }, { type: 'scaledDamage', value: 7, scaling: { source: 'overclockStacks', multiplier: 7 } }],
        description: '오버클럭: 무작위 해체 1×스택, 적에게 7+(스택×7) 피해. (해체 수 이상의 패 필요)'
    },
    {
        id: 'OC_003', name: '단기출력 펀치', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['overclock'],
        effects: [
            { type: 'scaledSelfDamage', value: 8, scaling: { source: 'overclockStacks', multiplier: 8 } },
            {
                type: 'conditional',
                condition: { type: 'hpBelow', value: 50 },
                thenEffects: [{ type: 'scaledDamage', value: 20, scaling: { source: 'overclockStacks', multiplier: 20 } }],
                elseEffects: [{ type: 'scaledDamage', value: 14, scaling: { source: 'overclockStacks', multiplier: 14 } }]
            }
        ],
        description: '오버클럭: 자해 8+(스택×8). 체력 50% 이하면 20+(스택×20), 아니면 14+(스택×14) 피해.'
    },
    {
        id: 'OC_004', name: '배터리 스매시', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overload', value: 1, scaling: { source: 'overclockStacks', multiplier: 1 } }, { type: 'scaledDamage', value: 11, scaling: { source: 'overclockStacks', multiplier: 11 } }],
        description: '오버클럭: 과부하(1+스택), 적에게 11+(스택×11) 피해.'
    },
    {
        id: 'OC_005', name: '비상 전력 가동', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['overclock'],
        effects: [{ type: 'scaledSelfDamage', value: 3, scaling: { source: 'overclockStacks', multiplier: 3 } }, { type: 'energy', value: 1 }],
        description: '오버클럭: 자해 3+(스택×3), 에너지 1 획득.'
    },
    {
        id: 'OC_006', name: '초단기 스파크', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['overclock', 'dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: false }, { type: 'conditionalByDismantledType', attack: [{ type: 'energy', value: 1 }], skill: [{ type: 'draw', value: 1 }] }],
        description: '오버클럭: 카드 1장 해체. 공격이면 에너지 1, 스킬이면 드로우 1.'
    },
    {
        id: 'OC_007', name: '임시 방열판', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['overclock'],
        playCondition: { type: 'overclockMin', value: 1 },
        effects: [{ type: 'overclockReduce', value: 1 }, { type: 'draw', value: 2 }, { type: 'dismantle', value: 1, random: true }],
        description: '오버클럭 스택 1 이상일 때 사용 가능. 스택 -1, 카드 2장 드로우, 1장 해체.'
    },
    {
        id: 'OC_008', name: '위험한 추진력', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'selfDamage', value: 8 }],
        description: '카드 1장 드로우, 체력 8 감소.'
    },
    {
        id: 'OC_009', name: '땜질된 회로', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [
            { type: 'scaledSelfDamagePercent', value: 8, scaling: { source: 'overclockStacks', multiplier: 8 } },
            { type: 'scaledDraw', value: 1, scaling: { source: 'overclockStacks', multiplier: 1 } }
        ],
        description: '오버클럭. 체력 8+(스택×8)% 감소, 카드 1+(스택×1)장 드로우.'
    },
    {
        id: 'OC_010', name: '예열 일격', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{
            type: 'scaledDamage', value: 6,
            scaling: { source: 'overloadStacks', multiplier: 3 }
        }],
        description: '적에게 6+(과부하×3) 피해.'
    },
    // === Tier 2 (10장) ===
    {
        id: 'OC_011', name: '리미터 해제 타격', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['overclock'],
        effects: [
            { type: 'scaledSelfDamage', value: 4, scaling: { source: 'overclockStacks', multiplier: 4 } },
            { type: 'scaledDamage', value: 8, scaling: { source: 'overclockStacks', multiplier: 8 } },
            { type: 'scaledDamage', value: 0, scaling: { source: 'overloadStacks', multiplier: 2 } }
        ],
        description: '오버클럭: 자해 4+(스택×4), 적에게 8+(스택×8) + 과부하당 2 추가 피해.'
    },
    {
        id: 'OC_012', name: '고압 전류 방출', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['overcurrent'],
        effects: [{
            type: 'conditional',
            condition: { type: 'overclockMin', value: 2 },
            thenEffects: [{ type: 'damage', value: 25 }, { type: 'weakness', value: 3 }],
            elseEffects: [{ type: 'damage', value: 10 }]
        }],
        description: '과전류(2): 25 피해 + 약화 3, 미달 시 10 피해.'
    },
    {
        id: 'OC_013', name: '목숨 건 참격', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 18 }, { type: 'nextTurnSelfDamage', value: 12 }],
        description: '적에게 18 피해. 다음 턴 체력 12 자해.'
    },
    {
        id: 'OC_014', name: '과열된 총신', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 2, cost: 3,
        keywords: ['overclock'],
        effects: [{ type: 'damage', value: 40 }, { type: 'overclockReduce', value: 1 }, { type: 'overload', value: 1 }],
        description: '40 피해, 오버클럭 -1, 과부하(1).'
    },
    {
        id: 'OC_015', name: '위험 수위 돌파', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 7, hits: 3 }, { type: 'selfWeakness', value: 2 }],
        description: '7의 피해 ×3. 약화 2 자가 부여.'
    },
    {
        id: 'OC_016', name: '코어 강제 주입', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'selfDamage', value: 12 }, { type: 'energy', value: 3 }, { type: 'overload', value: 1 }],
        description: '자해 12, 에너지 3, 과부하(1).'
    },
    {
        id: 'OC_017', name: '불안정한 장갑판', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 12 }, { type: 'overload', value: 1 }],
        description: '12의 방어도. 과부하(1).'
    },
    {
        id: 'OC_018', name: '전력 과소비', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['overclock'],
        effects: [{ type: 'draw', value: 3 }, { type: 'overload', value: 1 }, { type: 'overclockGain', value: 2 }],
        description: '3장 드로우, 과부하(1), 오버클럭 +2.'
    },
    {
        id: 'OC_019', name: '수동 쿨다운', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledShield', value: 0, scaling: { source: 'overclockConsumed', multiplier: 5 } }],
        description: '오버클럭 스택 全소모, 소모한 스택 ×5 방어도.'
    },
    {
        id: 'OC_020', name: '한계 돌파 태세', pack: 'overclock',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'overclockPerTurn', value: 1, energyCost: 1 },
        description: '매 턴 에너지 1 잃고 오버클럭 +1.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'OC_021', name: '과전류 방출', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledDamage', value: 0, scaling: { source: 'overclockConsumed', multiplier: 20 } }, { type: 'overload', value: 1 }],
        description: '오버클럭 全소모, 스택당 20 피해, 과부하(1).'
    },
    {
        id: 'OC_022', name: '멜트다운 스트라이크', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['overclock'],
        effects: [
            { type: 'scaledDamage', value: 24, scaling: { source: 'overclockStacks', multiplier: 24 } },
            { type: 'scaledMaxHpReduce', value: 10, scaling: { source: 'overclockStacks', multiplier: 10 } }
        ],
        description: '오버클럭. 24+(스택×24) 피해, 최대 체력 10+(스택×10) 감소.'
    },
    {
        id: 'OC_023', name: '수명 단축 빔', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [
            { type: 'scaledDamage', value: 12, scaling: { source: 'overclockStacks', multiplier: 12 } },
            { type: 'scaledSelfWeakness', value: 2, scaling: { source: 'overclockStacks', multiplier: 2 } }
        ],
        description: '오버클럭: 12+(스택×12) 피해, 자신에게 약화 2+(스택×2) 부여.'
    },
    {
        id: 'OC_024', name: '긴급 냉각 펄스', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledShield', value: 0, scaling: { source: 'overclockConsumed', multiplier: 15 } }],
        description: '오버클럭 全소모, 스택당 15 방어도.'
    },
    {
        id: 'OC_025', name: '냉각수 배출', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: false }, { type: 'overloadReduce', value: 1 }],
        description: '카드 1장 선택 해체, 과부하 1 감소.'
    },
    {
        id: 'OC_026', name: '리스크 청산', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'heal', value: 35 }, { type: 'preventSelfDamageIfOverclock', threshold: 3 }, { type: 'maxHpReduce', value: 2 }],
        description: '체력 35 회복, 최대체력 2 감소. 오버클럭 3 이상이면 다음 카드의 자해 면제.'
    },
    {
        id: 'OC_027', name: '임계점 도달', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overcurrent'],
        effects: [{
            type: 'conditional',
            condition: { type: 'overclockMin', value: 4 },
            thenEffects: [{ type: 'draw', value: 3 }, { type: 'energy', value: 2 }, { type: 'overclockReset' }],
            elseEffects: [{ type: 'draw', value: 1 }]
        }],
        description: '과전류(4): 3장 드로우 + 에너지 2 + 오버클럭 초기화. 미달 시 1장.'
    },
    {
        id: 'OC_028', name: '강제 각성', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'selfDamagePercent', value: 30 }, { type: 'overclockGain', value: 3 }],
        description: '최대 체력의 30%만큼 자해하고 오버클럭 스택을 3 얻습니다.'
    },
    {
        id: 'OC_029', name: '안전 모드 전환', pack: 'overclock',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'healOnHighOverclock', threshold: 3, value: 20 },
        description: '턴 종료 시 오버클럭 3+ 이면 스택-1, 체력 20 회복.'
    },
    {
        id: 'OC_030', name: '고위험 고수익 프로토콜', pack: 'overclock',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'shieldOnOverclock', value: 4 },
        description: '오버클럭 카드 사용 시 방어도 4'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'OC_031', name: '묵직한 막타', pack: 'overclock',
        type: 'attack', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['overclock'],
        costScaling: { source: 'overclockStacks', multiplier: 1 },
        effects: [
            { type: 'scaledDamage', value: 15, scaling: { source: 'overclockStacks', multiplier: 15 } },
            { type: 'scaledDamage', value: 0, scaling: { source: 'targetLostHp', multiplier: 0.04, stackScaling: 0.04, max: 200 } }
        ],
        description: '15 피해 + 오버클럭 스택당 +15 피해. 적 잃은 체력의 4%(스택당 +4%, 최대 200) 추가. 코스트도 스택당 +1.'
    },
    {
        id: 'OC_032', name: '초신성 폭발', pack: 'overclock',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 4,
        keywords: ['overcurrent', 'overclock'],
        playCondition: { type: 'overclockMin', value: 4 },
        effects: [
            { type: 'overload', value: 3 },
            { type: 'overclockConsume' },
            { type: 'scaledDamage', value: 100, scaling: { source: 'overclockConsumed', multiplier: 20 } }
        ],
        description: '과전류(4) 과부하(3). 100 피해 + 오버클럭 스택당 20 추가 피해.'
    },
    {
        id: 'OC_033', name: '오버 드라이브 코어', pack: 'overclock',
        type: 'attack', rarity: 'unique', tier: 4, cost: 10,
        keywords: ['overclock'],
        effects: [{ type: 'damage', value: 100 }, { type: 'costReductionPerOverclock' }],
        description: '100 피해 (오버클럭 스택에 따라 코스트 감소).'
    },
    {
        id: 'OC_034', name: '냉각팬 증설', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: ['overclock', 'rebuild'],
        rebuildCount: 1,
        effects: [{ type: 'overclockReduce', value: 1 }, { type: 'draw', value: 1 }],
        description: '재구축(1). 오버클럭 -1, 카드 1장 드로우.'
    },
    {
        id: 'OC_035', name: '절대 영도 펄스', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: [],
        effects: [
            { type: 'consumeAllEnergy' },
            { type: 'scaledShield', value: 0, scaling: { source: 'energyConsumed', multiplier: 20 } },
            { type: 'forceTurnEnd' }
        ],
        description: '남은 에너지 전소모. 소모한 에너지×20 방어도 획득. 턴 즉시 종료.'
    },
    {
        id: 'OC_036', name: '운명 거스르기', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: [],
        effects: [{ type: 'scaledDamage', value: 0, scaling: { source: 'selfDamageThisTurn', multiplier: 1 } }],
        description: '이번 턴 받은 모든 피해만큼 적에게 피해.'
    },
    {
        id: 'OC_037', name: '모든 제한 해제', pack: 'overclock',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: ['overclock'],
        effects: [{ type: 'removeOverclockLimit' }],
        description: '이번 전투 동안 오버클럭 스택의 최대치(4) 제한이 사라지며, 턴 종료 시 오버클럭 스택이 감소하지 않습니다.'
    },
    {
        id: 'OC_038', name: '영구 기관 코어', pack: 'overclock',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'fixedDemerit', value: 3 },
        description: '오버클럭 카드 사용 시 디메리트(자해/과부하) 계산에 쓰이는 오버클럭 스택을 3으로 고정.'
    },
    {
        id: 'OC_039', name: '불멸의 사이보그', pack: 'overclock',
        type: 'power', rarity: 'unique', tier: 4, cost: 3,
        keywords: [],
        effects: [],
        powerEffect: { type: 'reviveOnce', value: 30 },
        description: '체력 0 시 1회 30% 회복 부활.'
    },
    {
        id: 'OC_040', name: '광기의 톱니바퀴', pack: 'overclock',
        type: 'power', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'madGearBothDamage' },
        description: '카드 사용 시 양쪽 모두 오버클럭 스택만큼 피해를 입는다.'
    }
]);

// ─── 해체/재구축 팩 (40장) ───
registerPack('dismantle', {
    name: '해체/재구축 팩',
    description: '해체(버림), 추출(버려질 때 효과), 재구축(반복 사용) 시너지',
    totalCards: 40
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'DM_001', name: '고철 던지기', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 7 }, { type: 'dismantle', value: 1, random: false }],
        description: '7 피해. 손의 카드 1장 선택 해체.'
    },
    {
        id: 'DM_002', name: '맹목적 사격', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 7 }],
        extractEffects: [{ type: 'damage', value: 10 }],
        description: '7 피해. 추출: 10 피해.'
    },
    {
        id: 'DM_003', name: '분해 타격', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 12 }, { type: 'dismantle', value: 1, random: true }, { type: 'draw', value: 1 }],
        description: '12 피해. 무작위 카드 1장 해체, 1장 드로우.'
    },
    {
        id: 'DM_004', name: '스크랩 소드', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 8 }],
        extractEffects: [{ type: 'damage', value: 11 }, { type: 'strength', value: 3 }],
        description: '8 피해. 추출: 11 피해 + 다음 공격 +3.'
    },
    {
        id: 'DM_005', name: '불법 복제', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 2 }, { type: 'dismantle', value: 1, random: true }],
        description: '2장 드로우, 무작위 1장 해체.'
    },
    {
        id: 'DM_006', name: '데이터 백업', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'shield', value: 7 }],
        extractEffects: [{ type: 'shield', value: 10 }],
        description: '방어도 7. 추출: 방어도 10.'
    },
    {
        id: 'DM_007', name: '임시 땜빵', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 2,
        effects: [{ type: 'shield', value: 6 }],
        description: '재구축(2). 방어도 6.'
    },
    {
        id: 'DM_008', name: '부품 색출', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 3 }, { type: 'dismantle', value: 2, random: false }],
        description: '3장 드로우, 카드 2장 선택 해체.'
    },
    {
        id: 'DM_009', name: '긴급 탈출', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'searchByType', cardType: 'skill', value: 1 }],
        description: '덱에서 무작위 [스킬] 카드 1장을 서치하여 패에 추가. 코스트 0.'
    },
    {
        id: 'DM_010', name: '불량 배터리', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: true }, { type: 'draw', value: 1 }],
        description: '무작위 카드 1장 해체, 1장 드로우.'
    },
    // === Tier 2 (10장) ===
    {
        id: 'DM_011', name: '재활용 프레스', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle', 'rebuild'],
        rebuildCount: 2,
        effects: [{ type: 'damage', value: 14 }, { type: 'conditional', condition: { type: 'dismantledThisTurn', value: 1 }, thenEffects: [{ type: 'energy', value: 1 }] }],
        description: '재구축(2). 14 피해, 이번 턴에 해체한 카드 있으면 에너지 1.'
    },
    {
        id: 'DM_012', name: '폐기물 폭격', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 6, hits: 4 }, { type: 'dismantle', value: 1, random: true }],
        description: '6×4 피해, 무작위 1장 해체.'
    },
    {
        id: 'DM_013', name: '백도어 찌르기', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 9 }, { type: 'extract', thenEffects: [{ type: 'damage', value: 12 }, { type: 'draw', value: 1 }] }],
        description: '9 피해. 추출: 12 피해 + 카드 1장 드로우.'
    },
    {
        id: 'DM_014', name: '나노머신 톱', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 2, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 3,
        effects: [{ type: 'damage', value: 10 }],
        description: '재구축(3). 10 피해.'
    },
    {
        id: 'DM_015', name: '과부하 색출', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 3, random: false }, { type: 'draw', value: 3 }],
        description: '최대 3장 선택 해체, 해체 수만큼 드로우.'
    },
    {
        id: 'DM_016', name: '불연속 회피', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['extract'],
        effects: [{ type: 'damageReduction', value: 0.5 }, { type: 'extract', thenEffects: [{ type: 'invincible', value: 1 }] }],
        description: '이번 턴 받는 피해 절반. 추출: 이번 턴 무적.'
    },
    {
        id: 'DM_017', name: '메모리 최적화', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantleAllAndScaleDraw' }],
        description: '손패의 모든 카드를 해체합니다. 해체한 수만큼 카드를 드로우합니다.'
    },
    {
        id: 'DM_018', name: '부품 조립', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'searchByType', cardType: 'attack', value: 1 }],
        description: '덱에서 무작위 [공격] 카드 1장을 서치하여 패에 추가. 코스트 0.'
    },
    {
        id: 'DM_019', name: '방화벽 재구축', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['extract'],
        effects: [{ type: 'shield', value: 15 }, { type: 'extract', thenEffects: [{ type: 'shield', value: 15 }, { type: 'returnToHandNextTurn' }] }],
        description: '15의 방어도. 추출: 즉시 15 방어도 + 다음 턴 패로 복귀.'
    },
    {
        id: 'DM_020', name: '스크랩 수집가', pack: 'dismantle',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'damageOnDismantle', value: 4 },
        description: '해체할 때마다 적에게 4 피해.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'DM_021', name: '리사이클 빔', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        rebuildGrowth: 5,
        effects: [{ type: 'damage', value: 20 }],
        description: '20 피해. 패에 있는 동안 재구축 발동마다 피해 +5 성장.'
    },
    {
        id: 'DM_022', name: '데이터 파쇄', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['dismantle', 'rebuild'],
        rebuildCount: 1,
        effects: [
            { type: 'dismantle', value: 1, random: false },
            { type: 'damage', value: 15 },
            { type: 'conditional', condition: { type: 'dismantledThisTurn', value: 2 }, thenEffects: [{ type: 'damage', value: 10 }, { type: 'energyDrain', value: 1 }] }
        ],
        description: '재구축(1). 1장 해체 후 15 피해. 이번 턴 2장 이상 해체 시 추가 10 피해 + 적 다음 턴 에너지 1 감소.'
    },
    {
        id: 'DM_023', name: '쓰레기통 투척', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'scaledDamage', value: 0, scaling: { source: 'dismantledThisBattle', multiplier: 3 } }],
        description: '이번 전투 총 해체 수 ×3 피해.'
    },
    {
        id: 'DM_024', name: '블랙마켓 거래', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'selfDamage', value: 8 }, { type: 'draw', value: 3 }, { type: 'dismantle', value: 2, random: true }],
        description: '자해 8, 3장 드로우, 무작위 2장 해체.'
    },
    {
        id: 'DM_025', name: '무한 동력 수배', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: [],
        effects: [{ type: 'setupExtractEnergy', value: 3 }],
        description: '이번 턴 패에서 추출 발동마다 에너지 1 (최대 3회, 중첩 불가).'
    },
    {
        id: 'DM_026', name: '강제 데이터 덤프', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantleAllAndScaleShield', multiplier: 12 }],
        description: '현재 손에 있는 모든 카드를 해체합니다. 해체한 카드 1장당 12의 방어도를 얻습니다.'
    },
    {
        id: 'DM_027', name: '예비품 가동', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 1,
        effects: [{ type: 'searchByType', cardTypes: ['power', 'skill'], value: 1, fromTop: true, costAdd: -1 }],
        description: '재구축(1). 덱 맨 위에서 [파워] 또는 [스킬] 카드 1장 서치. 코스트 -1.'
    },
    {
        id: 'DM_028', name: '스크랩 실드', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'scaledShield', value: 0, scaling: { source: 'dismantledCount', multiplier: 4 } }],
        description: '이번 전투 해체 총 수 ×4 방어도.'
    },
    {
        id: 'DM_029', name: '고효율 파쇄기', pack: 'dismantle',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'drawOnDismantle', threshold: 5, value: 1 },
        description: '카드 5장 해체 시마다 1장 드로우.'
    },
    {
        id: 'DM_030', name: '재구축 프로토콜', pack: 'dismantle',
        type: 'power', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['rebuild'],
        powerEffect: { type: 'extraRebuildCount', value: 1 },
        description: '재구축(x)의 횟수가 1회 더 늘어납니다.'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'DM_031', name: '가비지 콜렉터', pack: 'dismantle',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['dismantle'],
        effects: [
            { type: 'damage', value: 40 },
            {
                type: 'conditional',
                condition: { type: 'dismantledThisTurn', value: 3 },
                thenEffects: [
                    { type: 'dismantleAllAndScaleShield', multiplier: 0 },
                    { type: 'draw', value: 5 }
                ]
            }
        ],
        description: '40 피해. 이번 턴 3장 이상 해체했다면, 현재 패 전체 해체 후 5장 드로우.'
    },
    {
        id: 'DM_032', name: '차원 파쇄포', pack: 'dismantle',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 4,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 150 }, { type: 'dismantleTop', value: 5 }],
        description: '150 피해, 덱 위 5장 해체.'
    },
    {
        id: 'DM_033', name: '정크 골렘 강림', pack: 'dismantle',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['rebuild', 'dismantle', 'extract'],
        rebuildCount: 1,
        effects: [{ type: 'damage', value: 60 }, { type: 'dismantle', value: 1, random: true }],
        extractEffects: [{ type: 'energy', value: 2 }, { type: 'damage', value: 40 }],
        description: '재구축(1). 60 피해 + 무작위 1장 해체. 추출 시: 에너지 2 회복, 적에게 40 피해.'
    },
    {
        id: 'DM_034', name: '시스템 롤백', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantleAllAndVoidRecall', recallCount: 4 }],
        description: '손패를 모두 해체합니다. 최근 소멸 카드 최대 4장을 임시로 손패에 추가합니다. 턴 종료 시 사용하지 않은 임시 카드는 영구 소멸합니다.'
    },
    {
        id: 'DM_035', name: '등가 교환 연성 진', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 2, random: false }, { type: 'searchByType', cardType: 'power', value: 2 }],
        description: '2장 선택 해체. 덱에서 파워 카드 2장 서치 + 코스트 0.'
    },
    {
        id: 'DM_036', name: '쓰레기통 기적', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: ['dismantle'],
        effects: [{
            type: 'conditional',
            condition: { type: 'dismantledThisBattle', value: 15 },
            thenEffects: [{ type: 'healPercent', value: 30 }, { type: 'energy', value: 3 }],
            elseEffects: []
        }],
        description: '전투 동안 15장+ 해체 시 체력 30% 회복 + 에너지 3.'
    },
    {
        id: 'DM_037', name: '극한의 압축 설계', pack: 'dismantle',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 1,
        keywords: ['rebuild', 'dismantle'],
        rebuildCount: 3,
        effects: [{ type: 'dismantleTop', value: 3 }],
        description: '재구축(3). 덱 위 3장 해체.'
    },
    {
        id: 'DM_038', name: '블랙홀 분쇄기', pack: 'dismantle',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'energyAndDrawOnFirstDismantle', energy: 2, draw: 2 },
        description: '매 턴 최초 해체 시 에너지 2 + 2장 드로우.'
    },
    {
        id: 'DM_039', name: '영구기관 조립기', pack: 'dismantle',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['rebuild'],
        effects: [],
        powerEffect: { type: 'healAndCostReductionOnRebuild', heal: 20, costReduction: 1 },
        description: '재구축 복귀 시 코스트 -1 + 체력 20 회복.'
    },
    {
        id: 'DM_040', name: '무한의 츠쿠요미', pack: 'dismantle',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['rebuild'],
        effects: [],
        powerEffect: { type: 'damageOnRebuild', multiplier: 5 },
        description: '재구축 시 총 재구축 횟수 ×5 고정 데미지.'
    }
]);

// ─── 네트워크 프로토콜 팩 (40장) ───
registerPack('network', {
    name: '네트워크 프로토콜 팩',
    description: '네트워크(스택) 누적과 프로토콜[조건] 연계 시너지. 카드 연쇄 콤보.',
    totalCards: 40
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'NW_001', name: '핑(Ping) 전송', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 0,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 1, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '1 + n×1 피해. [네트워크]'
    },
    {
        id: 'NW_002', name: '패킷 강타', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledDamage', value: 2, scaling: { source: 'networkStacks', multiplier: 2 } }],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'draw', value: 1 }],
        description: '2 + n×2 피해. 프로토콜[스킬]: 1장 드로우.'
    },
    {
        id: 'NW_003', name: '연쇄 절단', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 8 }],
        protocolCondition: 'attack',
        protocolEffects: [{ type: 'damage', value: 5 }],
        description: '8 피해. 프로토콜[공격]: 추가 5 피해.'
    },
    {
        id: 'NW_004', name: '트래픽 마비', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 8, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '8 + n×2 피해. [네트워크]'
    },
    {
        id: 'NW_005', name: '노드 접속', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'draw', value: 1 }, { type: 'scaledDamage', value: 1, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '1장 드로우, 1 + n×1 피해. [네트워크]'
    },
    {
        id: 'NW_006', name: '방화벽 재할당', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledShield', value: 3, scaling: { source: 'networkStacks', multiplier: 1 } }],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'shield', value: 5 }],
        description: '3 + n×1 방어도. 프로토콜[스킬]: 추가 방어도 5.'
    },
    {
        id: 'NW_007', name: '서브루틴 가동', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['network'],
        effects: [{ type: 'protocolBypass', value: 1 }, { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '0 + n×1 방어도. 다음 카드 프로토콜 자동 충족. [네트워크]'
    },
    {
        id: 'NW_008', name: '백그라운드 핑', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'energy', value: 1 }, { type: 'draw', value: 1 }],
        description: '에너지 1, 카드 1장 드로우.'
    },
    {
        id: 'NW_009', name: '라우팅 최적화', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'costReductionRandom', count: 2, value: 1 }],
        description: '내 손패의 무작위 카드 최대 2장의 비용을 이번 턴 동안 1 감소시킵니다. [네트워크]'
    },
    {
        id: 'NW_010', name: '우회 접속', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'searchByType', keyword: 'network', value: 1, keepCost: true }],
        description: '덱에서 무작위 [네트워크] 카드 1장을 서치하여 패에 추가.'
    },
    // === Tier 2 (10장) ===
    {
        id: 'NW_011', name: '동기화 타격', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['protocol'],
        effects: [],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'damage', value: 10, scale: 2 }],
        protocolElseEffects: [{ type: 'damage', value: 10 }],
        description: '10 피해. 프로토콜[스킬]: (10+힘)×2 피해.'
    },
    {
        id: 'NW_012', name: '악성 루프', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['network', 'rebuild', 'protocol'],
        rebuildCount: 1,
        effects: [{ type: 'scaledDamage', value: 8, scaling: { source: 'networkStacks', multiplier: 1 } }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'virus', value: 3 }],
        description: '재구축(1). 8 + n×1 피해. 프로토콜[네트워크]: 바이러스(3).'
    },
    {
        id: 'NW_013', name: '디도스(DDoS) 폭격', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 4, hits: 5 }],
        protocolCondition: 'zeroCost',
        protocolEffects: [{ type: 'armorPierce', value: true }],
        description: '4×5 피해. 프로토콜[0코스트]: 방어도 무시.'
    },
    {
        id: 'NW_014', name: '오버플로우 스트라이크', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledDamage', value: 10, scaling: { source: 'networkStacks', multiplier: 2 } }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'draw', value: 1 }],
        description: '10 + n×2 피해. 프로토콜[네트워크]: 1장 드로우.'
    },
    {
        id: 'NW_015', name: '다중 포트 개방', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['network'],
        effects: [
            { type: 'energy', value: 2 },
            { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 1 } },
            { type: 'conditional', condition: { type: 'networkCardsPlayed', value: 2 }, thenEffects: [], elseEffects: [{ type: 'selfDamage', value: 20 }] }
        ],
        description: '에너지 2, n×1 방어도. [네트워크] 3장 미만 사용 시 자해 20.'
    },
    {
        id: 'NW_016', name: '데이터 클로닝', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'zeroCostHandCard' }],
        description: '손패에서 가장 코스트 높은 카드 1장의 코스트를 0으로 만듭니다.'
    },
    {
        id: 'NW_017', name: '패킷 가로채기', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'shieldByHpPercent', value: 15 }],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'shieldByHpPercent', value: 30 }],
        description: '최대 HP의 15% 방어도. 프로토콜[스킬]: 30%.'
    },
    {
        id: 'NW_018', name: '논리 폭탄 세팅', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 0,
        keywords: ['network'],
        effects: [
            { type: 'weakness', value: 3 },
            { type: 'conditional', condition: { type: 'cardsPlayedThisTurn', value: 4 }, thenEffects: [{ type: 'energy', value: 1 }] }
        ],
        description: '약화 3 부여. 이번 턴 카드 4장 이상 사용 시 에너지 1. [네트워크]'
    },
    {
        id: 'NW_019', name: '매크로 캔슬', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 2, cost: 0,
        keywords: [],
        effects: [{ type: 'drawPerEnergy' }, { type: 'endTurn' }],
        description: '남은 에너지당 카드 1장 드로우 후 턴 종료.'
    },
    {
        id: 'NW_020', name: '봇넷 지휘소', pack: 'network',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'drawOnNetworkThreshold', threshold: 3, value: 1 },
        description: '매 턴 [네트워크] 3장 사용 시 [네트워크] 카드 1장 서치.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'NW_021', name: '연산력 오버드라이브', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 8, scaling: { source: 'networkStacks', multiplier: 4 } }],
        description: '8 + n×4 피해. [네트워크]'
    },
    {
        id: 'NW_022', name: '페이로드 투하', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{
            type: 'conditional',
            condition: { type: 'networkCardsPlayed', value: 2 },
            thenEffects: [{ type: 'damage', value: 30, scale: 2 }],
            elseEffects: [{ type: 'damage', value: 30 }]
        }],
        description: '30 피해. [네트워크] 2장+ 사용 시 (30+힘)×2 피해.'
    },
    {
        id: 'NW_023', name: '제로데이 익스플로잇', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 25 }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'armorPierce', value: true }],
        description: '25 피해. 프로토콜[네트워크]: 방어도 무시.'
    },
    {
        id: 'NW_024', name: '대역폭 증폭', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'protocolBypass', value: 2 }, { type: 'scaledShield', value: 5, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '5 + n×2 방어도. 다음 2장 프로토콜 자동 충족. [네트워크]'
    },
    {
        id: 'NW_025', name: '클라우드 덤프', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantleNetworkAndDraw' }],
        description: '손패의 모든 [네트워크] 카드 해체, 해체 수만큼 드로우.'
    },
    {
        id: 'NW_026', name: '시그널 체인', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['network'],
        effects: [{ type: 'draw', value: 3 }, { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '3장 드로우(코스트 0) + n×2 방어도. [네트워크]'
    },
    {
        id: 'NW_027', name: '프록시 방어막', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'shield', value: 10 }],
        protocolCondition: 'any',
        protocolEffects: [{ type: 'shield', value: 10 }],
        description: '방어도 10. 다음 프로토콜 발동 시 방어도 10 추가.'
    },
    {
        id: 'NW_028', name: '스레드 동기화', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'threadSync' }],
        description: '손패의 최고/최저 코스트 카드 해체, 코스트 합계 × n 피해. [네트워크]'
    },
    {
        id: 'NW_029', name: '루트 권한 탈취', pack: 'network',
        type: 'power', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'doubleThirdNetwork' },
        description: '매 턴 3번째 [네트워크] 카드 피해 2배.'
    },
    {
        id: 'NW_030', name: '병렬 처리 엔진', pack: 'network',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'energyOnCardCount', thresholds: [4, 7, 10], value: 1 },
        description: '카드 4/7/10번째 사용 시 에너지 1.'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'NW_031', name: '기간 트래픽 충돌', pack: 'network',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 50, scaling: { source: 'networkStacks', multiplier: 10 } }],
        description: '50 + n×10 피해. [네트워크]'
    },
    {
        id: 'NW_032', name: '아포칼립스 프로토콜', pack: 'network',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['network', 'accumulation'],
        accumulationTarget: 6,
        effects: [{
            type: 'conditional',
            condition: { type: 'accumulationMet' },
            thenEffects: [
                { type: 'energy', value: 1 },
                { type: 'damage', value: 15, scaleSource: 'networkStacks' }
            ],
            elseEffects: [{ type: 'damage', value: 15 }]
        }],
        description: '[네트워크]. 15 피해. 축적(6): 에너지 1 + (15+15×N) 피해 (N=네트워크 스택).'
    },
    {
        id: 'NW_033', name: '양자 얽힘 스매시', pack: 'network',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'scaledDamage', value: 25, scaling: { source: 'totalDamageThisTurn', multiplier: 0.5 } }],
        description: '25 피해 + 이번 턴 총 피해의 50% 추가.'
    },
    {
        id: 'NW_034', name: '웜바이러스 배양', pack: 'network',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['network'],
        effects: [{
            type: 'conditional',
            condition: { type: 'cardsPlayedThisTurn', value: 5 },
            thenEffects: [{ type: 'draw', value: 3 }],
            elseEffects: [{ type: 'draw', value: 2 }]
        }],
        description: '2장 드로우. 카드 5장+ 사용 시 추가 1장. [네트워크]'
    },
    {
        id: 'NW_035', name: '마스터 오버라이드', pack: 'network',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 3,
        keywords: [],
        effects: [{ type: 'masterOverride' }],
        description: '손패 전부 버리고, 버린 수만큼 덱에서 고코스트 카드를 뽑아 코스트 1로 만듦.'
    },
    {
        id: 'NW_036', name: '초차원 게이트웨이', pack: 'network',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'revealAndTakeHighestCost', value: 3 }],
        description: '[네트워크]. 덱에서 무작위 3장 공개. 최고 코스트 카드 1장을 코스트 0으로 패에 추가, 나머지 2장은 덱 맨 위로.'
    },
    {
        id: 'NW_037', name: '시스템 완전 포맷', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'doubleNetworkStacks' },
        description: '이번 전투 동안 [네트워크] 스택이 2배로 증가합니다.'
    },
    {
        id: 'NW_038', name: '튜링 완전 신경망', pack: 'network',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: ['protocol'],
        effects: [],
        powerEffect: { type: 'damageAndShieldOnProtocol', damage: 10, shield: 5 },
        description: '프로토콜 달성 시마다 적에게 10 고정 피해 + 방어도 5.'
    },
    {
        id: 'NW_039', name: '글로벌 넷 연결', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['accumulation'],
        accumulationTarget: 8,
        effects: [
            { type: 'addExtraDraw', value: 1 },
            {
                type: 'conditional',
                condition: { type: 'accumulation', value: 8 },
                thenEffects: [{ type: 'addExtraDraw', value: 1 }]
            }
        ],
        description: '기본 드로우 매수 +1. 축적(8): +1 더 증가.'
    },
    {
        id: 'NW_040', name: '사이버 고스트 상태', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'energyCarryOver', maxEnergy: 10 },
        description: '남은 에너지 이월 (최대 10).'
    }
]);

// ═══════════════════════════════════════════
// 5. 바이오 해저드 (바이오닉·감염) 팩 (40장)
// ═══════════════════════════════════════════
registerPack('biohazard', {
    name: '바이오 해저드 팩',
    description: '바이러스와 부식으로 적을 좀먹고 폭주로 폭발시키는 팩',
    totalCards: 40
});

registerCards([
    // === Tier 1 (10장) ===
    {
        id: 'BIO_001', name: '감염 주사', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'damage', value: 4 }, { type: 'virus', value: 1 }],
        description: '적에게 4 피해, 바이러스(1) 부여.'
    },
    {
        id: 'BIO_002', name: '독성 스크래치', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 6 }, { type: 'virus', value: 2 }],
        description: '적에게 6 피해, 바이러스(2) 부여.'
    },
    {
        id: 'BIO_003', name: '부식성 타격', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['corrosion'],
        effects: [{ type: 'damage', value: 7 }, { type: 'corrosion', value: 1 }],
        description: '적에게 7의 피해를 주고, 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_004', name: '변이체 난사', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'damage', value: 4, hits: 3 },
            { type: 'virus', value: 3 } // 1스택 * 3회 (간편화를 위해 총량 부여)
        ],
        description: '적에게 4의 피해를 3번 줍니다. 각 히트마다 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_005', name: '변이체 배양', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['virus'],
        effects: [{ type: 'virus', value: 3 }, { type: 'draw', value: 1 }],
        description: '바이러스(3)를 부여합니다. 카드를 1장 뽑습니다.'
    },
    {
        id: 'BIO_006', name: '표피 경화', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['corrosion'],
        effects: [{ type: 'shield', value: 10 }, { type: 'corrosion', target: 'self', value: 1 }],
        description: '10의 방어도를 얻고, 나에게 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_007', name: '감염 확산', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'consumeVirus', consume: 8, draw: 2 }],
        description: '폭주(8): 카드를 2장 뽑습니다.'
    },
    {
        id: 'BIO_008', name: '미약한 격발', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'consumeVirus', consume: 'all', multiplier: 1 }],
        description: '폭주(전부): 적의 바이러스 스택을 전부 소모합니다. 소모한 수치만큼 고정 피해를 줍니다.'
    },
    {
        id: 'BIO_009', name: '생체 신호 교란', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['virus'],
        effects: [{ type: 'weakness', value: 1 }, { type: 'virus', value: 2 }],
        description: '적에게 약화(1)를 부여합니다. 바이러스(2)를 부여합니다.'
    },
    {
        id: 'BIO_010', name: '세포벽 강화', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'shield', value: 15 },
            { type: 'consumeVirus', consume: 0, threshold: 8, shield: 12 }
        ],
        description: '15의 방어도를 얻습니다. 적의 바이러스 수치가 8 이상이면 방어도를 12 추가로 얻습니다.'
    },

    // === Tier 2 (10장) ===
    {
        id: 'BIO_011', name: '숙주 기생', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 7 }, { type: 'conditional', condition: { type: 'virusMin', value: 5 }, thenEffects: [{ type: 'damage', value: 10 }] }],
        description: '7 피해. 적 바이러스 5 이상이면 추가 10 피해.'
    },
    {
        id: 'BIO_012', name: '부식 침투탄', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['corrosion', 'virus'],
        effects: [
            { type: 'damage', value: 12 },
            { type: 'corrosion', value: 2 },
            { type: 'conditionalAdd', condition: 'targetShieldZero', addVirus: 3 }
        ],
        description: '적에게 12의 피해를 줍니다. 부식(2)를 부여합니다. 적의 방어도가 0이면 바이러스(3)을 추가 부여합니다.'
    },
    {
        id: 'BIO_013', name: '산성 분사', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['corrosion'],
        effects: [
            { type: 'damage', value: 10 },
            { type: 'corrosion', value: 1 },
            { type: 'conditionalAdd', condition: 'corrosionTarget', conditionValue: 1, addVirus: 3 }
        ],
        description: '적에게 10의 피해를 줍니다. 부식(1)을 부여합니다. 적에게 부식이 이미 있으면 바이러스(3)를 추가로 부여합니다.'
    },
    {
        id: 'BIO_014', name: '데이터 흡수', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'consumeVirus', consume: 6, energy: 2, shield: 10 }],
        description: '폭주(6): 에너지를 2 얻고 10의 방어도를 얻습니다.'
    },
    {
        id: 'BIO_015', name: '면역 억제제', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['virus'],
        // '면역 억제제'의 경우 바이러스 부여 후 자신이 5인지 판정해야함 
        effects: [
            { type: 'virus', value: 3 },
            { type: 'consumeVirus', consume: 0, threshold: 5, draw: 1 }
        ],
        description: '바이러스(3)를 부여합니다. 이번 턴에 적에게 부여된 바이러스 수치가 5 이상이면 카드를 1장 뽑습니다.'
    },
    {
        id: 'BIO_016', name: '바이오 실드', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['corrosion'],
        effects: [
            { type: 'scaledShield', value: 0, scaling: { source: 'targetVirus', multiplier: 0.5 } },
            { type: 'corrosion', value: 1 }
        ],
        description: '적에게 쌓인 바이러스 스택의 절반(내림)만큼 방어도를 얻습니다. 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_017', name: '세포 분열 촉진', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'virus', value: 8 },
            { type: 'consumeVirus', consume: 0, threshold: 10, energy: 1 }
        ],
        description: '바이러스(8)를 부여합니다. 적에게 이미 바이러스가 10 이상 있다면 에너지를 1 얻습니다.'
    },
    {
        id: 'BIO_018', name: '감염원 추적', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }, { type: 'virus', value: 7 }],
        description: '카드를 2장 뽑습니다. 바이러스(7)를 부여합니다.'
    },
    {
        id: 'BIO_019', name: '만성 감염 프로토콜', pack: 'biohazard',
        type: 'power', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['virus'],
        powerEffect: { type: 'autoVirus', value: 4 },
        description: '(설치) 매 턴 시작 시, 적에게 자동으로 바이러스(4)를 부여합니다.'
    },
    {
        id: 'BIO_020', name: '부식 필드', pack: 'biohazard',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['corrosion'],
        powerEffect: { type: 'autoCorrosion', value: 2 },
        description: '(설치) 매 턴 시작 시, 적에게 부식(2)을 추가로 부여합니다.'
    },

    // === Tier 3 (10장) ===
    {
        id: 'BIO_021', name: '전이성 격발', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['virus'],
        effects: [{ type: 'consumeVirus', consume: 'all', multiplier: 2 }],
        description: '폭주(전부): 바이러스 스택 2배 피해.'
    },
    {
        id: 'BIO_022', name: '괴사 침식', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['corrosion'],
        // 방어 무력화는 복잡하므로 damage 관통 + 데미지 증폭 꼼수 혹은 쉴드 파괴 이펙트 구현 필요
        effects: [
            { type: 'damage', value: 25 },
            { type: 'corrosion', value: 3 },
            { type: 'conditionalAdd', condition: 'corrosionTarget', conditionValue: 15, destroyShield: true, consumeCorrosion: true }
        ],
        description: '적에게 25의 피해를 줍니다. 부식(3)을 부여합니다. 적에게 부식이 15 이상이면 방어도 전부 제거 + 부식 전부 소모.'
    },
    {
        id: 'BIO_023', name: '용해성 맹독', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 3, cost: 1,
        keywords: ['corrosion'],
        effects: [{ type: 'meltToxin' }],
        description: '폭주(6): 적에게 10의 피해를 줍니다. 적에게 약화(2) + 부식(5)을 부여합니다.'
    },
    {
        id: 'BIO_024', name: '생체 병기 투사', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'damage', value: 9, hits: 4 },
            { type: 'virus', value: 6 }
        ],
        description: '적에게 9의 피해를 4번 줍니다. 바이러스(6)를 부여합니다.'
    },
    {
        id: 'BIO_025', name: '대유행 선언', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 3, cost: 2,
        keywords: ['virus', 'corrosion'],
        effects: [
            { type: 'virus', value: 12 },
            { type: 'corrosion', value: 3 },
            { type: 'draw', value: 1 }
        ],
        description: '적에게 바이러스(12) + 부식(3)를 부여합니다. 카드를 1장 뽑습니다.'
    },
    {
        id: 'BIO_026', name: '항체 약탈', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['virus'],
        effects: [{ type: 'consumeVirus', consume: 6, heal: 30, strength: 5 }],
        description: '폭주(6): 체력 30 회복 + 힘 5.'
    },
    {
        id: 'BIO_027', name: '변종 적응체', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['virus'],
        effects: [{ type: 'consumeVirus', consume: 'scaled', max: 15, shieldPerStack: 5 }],
        description: '폭주(최대 15): 소모 스택당 방어도 5.'
    },

    // === Tier 4 (10장) ===
    {
        id: 'BIO_028', name: '보균자 역류', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 3, cost: 2,
        keywords: ['corrosion', 'virus'],
        effects: [
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 5 },
            { type: 'virusByDebuff', debuff: 'corrosion', multiplier: 1 }
        ],
        description: '적에게 쌓인 부식 스택 1당 5의 고정 피해를 줍니다. 스택 1당 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_029', name: '전염병 연구소', pack: 'biohazard',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['virus'],
        effects: [],
        powerEffect: { type: 'viral_lab' }, // 바이러스 부여 효과시 가로채서 +1 하는 파워 
        description: '(설치) 내가 적에게 바이러스 스택을 부여할 때마다, 수치가 1 추가로 증가합니다.'
    },
    {
        id: 'BIO_030', name: '면역계 장악', pack: 'biohazard',
        type: 'power', rarity: 'unique', tier: 3, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'immune_system_takeover' },
        description: '(설치) 내가 폭주할 때마다, 소모한 양의 절반(내림)만큼 방어도를 얻습니다.'
    },
    {
        id: 'BIO_031', name: '팬데믹 스톰', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['overdrive'],
        effects: [{ type: 'consumeVirus', consume: 'all', multiplier: 3 }],
        description: '폭주(전부): 바이러스 3배 피해.'
    },
    {
        id: 'BIO_032', name: '네크로시스', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3, // 밸패 반영: 기본 15피해
        keywords: ['corrosion'],
        effects: [
            { type: 'damage', value: 30 },
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 6 }
        ],
        description: '적에게 30의 피해를 줍니다. 적에게 부식이 있으면 부식 스택 × 6만큼 추가 피해를 줍니다.'
    },
    {
        id: 'BIO_033', name: '세포 용해 폭탄', pack: 'biohazard',
        type: 'attack', rarity: 'legendary', tier: 4, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'damage', value: 20 },
            { type: 'damageByDebuff', debuff: 'virus', multiplier: 1 },
            { type: 'virus', value: 8 },
            { type: 'conditionalAdd', condition: 'virusTarget', conditionValue: 20, halveStrength: true }
        ],
        description: '적에게 20 + 바이러스 스택 만큼의 피해를 줍니다. 바이러스(8) 를 부여합니다. 적의 바이러스가 20 이상이면 적의 힘을 절반으로 만듭니다.'
    },
    {
        id: 'BIO_034', name: '바이오 리퀴데이터', pack: 'biohazard',
        type: 'attack', rarity: 'legendary', tier: 4, cost: 2,
        keywords: ['accumulation'],
        accumulationTarget: 5,
        accumulationStack: 0,
        effects: [{ type: 'damage', value: 30 }],
        accumulationEffects: [
            { type: 'damageByDebuff', debuff: 'virus', multiplier: 1 }
        ],
        description: '적에게 30의 피해를 줍니다. 축적(5): 적의 바이러스 스택 만큼 추가 피해.'
    },
    {
        id: 'BIO_035', name: '오메가 변이', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['accumulation'],
        accumulationTarget: 6,
        accumulationStack: 0,
        effects: [
            { type: 'virus', value: 14 }
        ],
        accumulationEffects: [
            { type: 'consumeVirus', consume: 0, threshold: 0, draw: 2, energy: 2 }
        ],
        description: '적에게 바이러스(14)을 부여합니다. 축적(6): 에너지를 2 얻고 카드를 2장 뽑습니다.'
    },

    // === Tier 5 (5장) ===
    {
        id: 'BIO_036', name: '생체 정화 장막', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: [],
        effects: [{ type: 'consumeVirus', consume: 10, shield: 30, heal: 50 }],
        description: '폭주(10): 30의 방어도를 얻고 체력을 50 회복합니다.'
    },
    {
        id: 'BIO_037', name: '감염원 증폭기', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['accumulation'],
        accumulationTarget: 8,
        accumulationStack: 0,
        effects: [
            { type: 'doubleVirus' }
        ],
        accumulationEffects: [
            { type: 'virus', value: 10 },
            { type: 'damageByDebuff', debuff: 'virus', multiplier: 1 }
        ],
        description: '적의 바이러스 스택을 2배 증가시킵니다. 축적(8): 바이러스(10)를 추가로 부여하고, 바이러스 스택만큼 고정 피해를 줍니다.'
    },
    {
        id: 'BIO_038', name: '바이러스 팜', pack: 'biohazard',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'virus_farm_start', roundedDown: true },
        description: '매 턴 시작 시, 적에게 쌓인 바이러스 스택의 25%(내림)만큼 자동으로 고정 피해를 줍니다.'
    },
    {
        id: 'BIO_039', name: '생물학적 무기 금고', pack: 'biohazard',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3, // 밸패 반영
        keywords: [],
        effects: [],
        powerEffect: { type: 'bio_weapon_vault' },
        description: '(설치) 내가 폭주할 때마다, 소모한 양의 절반(내림)만큼 영구 힘을 얻습니다.'
    },
    {
        id: 'BIO_040', name: '절대 감염체', pack: 'biohazard',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: ['virus', 'corrosion'],
        effects: [],
        powerEffect: { type: 'absolute_carrier', maxBonusStack: 8, value: 1 },
        description: '매 턴 시작 시 바이러스(8) + 부식(1)를 자동 부여합니다. 내가 폭주 카드를 사용할때 마다 에너지를 1 얻습니다.'
    },
]);

registerPack('russian_roulette', {
    name: '러시안 룰렛팩',
    description: '도박과 확률로 승부를 보는 하이리스크 하이리턴 팩',
    totalCards: 40
});

registerCards([
    // ─── 러시안 룰렛 팩 (40장) ───
    // Tier 1 (10장)
    {
        id: 'RU_001', name: '코인 토스 타격', pack: 'russian_roulette',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'damage', value: 8 }, { type: 'gamble', chance: 50, thenEffects: [{ type: 'damage', value: 7 }], elseEffects: [{ type: 'selfDamage', value: 7 }] }],
        description: '[도박: 50%] 적에게 8 피해. 행운: +7 피해. 불운: 내가 7 피해.'
    },
    {
        id: 'RU_002', name: '스크래치 액션', pack: 'russian_roulette',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'damage', value: 8 }, { type: 'gamble', chance: 40, thenEffects: [{ type: 'returnToHandZeroCost' }] }],
        description: '적에게 8 피해. [도박: 40%] 행운: 패로 돌아오고 코스트 0.'
    },
    {
        id: 'RU_003', name: '운명의 수레바퀴', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'damage', value: 20 }, { type: 'addLuck', value: 1 }, { type: 'gamble', chance: 30, thenEffects: [{ type: 'damage', value: 15 }], elseEffects: [{ type: 'discardRandom', value: 1 }] }],
        description: '20 피해. 행운 1 부여. [도박: 30%] 행운: +15 피해. 불운: 패 1장 버림.'
    },
    {
        id: 'RU_004', name: '야바위 펀치', pack: 'russian_roulette',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 33, thenEffects: [{ type: 'damage', value: 18 }], elseEffects: [{ type: 'selfDamage', value: 10 }] }],
        description: '[도박: 33%] 행운: 18 피해. 불운: 내게 10 피해.'
    },
    {
        id: 'RU_005', name: '밑장 빼기', pack: 'russian_roulette',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }, { type: 'addLuck', value: 1 }, { type: 'addEndOfTurnDiscard', value: 2 }],
        description: '카드를 2장 뽑고 행운을 1 얻습니다. 턴 종료 시 무작위 카드 2장을 버립니다.'
    },
    {
        id: 'RU_006', name: '칩스 가드', pack: 'russian_roulette',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'shield', value: 8 }, { type: 'gamble', chance: 40, thenEffects: [{ type: 'energy', value: 1 }] }],
        description: '방어도 8. [도박: 40%] 행운: 에너지 1.'
    },
    {
        id: 'RU_007', name: '확률 펌핑', pack: 'russian_roulette',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'diceRollLuck' }],
        description: '무작위 수(1~6)를 굴립니다. 나온 수만큼 행운을 얻습니다.'
    },
    {
        id: 'RU_008', name: '다이스 롤', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'diceRollCombo' }],
        description: '무작위 수(1~6)만큼 방어도를 얻고 같은 수만큼 피해.'
    },
    {
        id: 'RU_009', name: '리스크 헤징', pack: 'russian_roulette',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 50, thenEffects: [{ type: 'draw', value: 2 }], elseEffects: [{ type: 'draw', value: 1 }] }],
        description: '[도박: 50%] 행운: 2장 뽑음. 불운: 1장 뽑음.'
    },
    {
        id: 'RU_010', name: '눈먼 베팅', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['gamble'],
        effects: [
            { type: 'draw', value: 1 },
            {
                type: 'gamble',
                chance: 40,
                thenEffects: [{ type: 'adjustCostLastDrawn', set: 0 }],
                elseEffects: [{ type: 'adjustCostLastDrawn', add: 1 }]
            }
        ],
        description: '카드 1장 뽑음. [도박: 40%] 행운: 코스트 0. 불운: 코스트 1 증가.'
    },
    // Tier 2 (10장)
    {
        id: 'RU_011', name: '더블 업 배쉬', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 50, thenEffects: [{ type: 'damage', value: 30 }], elseEffects: [{ type: 'selfDamage', value: 10 }] }],
        description: '[도박: 50%] 행운: 30 피해. 불운: 내게 10 피해.'
    },
    {
        id: 'RU_012', name: '잭팟 참격', pack: 'russian_roulette',
        type: 'attack', rarity: 'epic', tier: 2, cost: 3,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 40, thenEffects: [{ type: 'damage', value: 20, scale: 3 }], elseEffects: [{ type: 'damage', value: 20, scale: 0.5 }] }],
        description: '데미지 20 피해[도박: 40%] 행운: 3배 피해. 불운: 피해 50% 감소.'
    },
    {
        id: 'RU_013', name: '이판사판 태클', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 10 }, { type: 'damageIfUnluckyThisTurn', value: 15 }],
        description: '10 피해. 이번 턴 불운을 겪었다면 +15 확정 피해.'
    },
    {
        id: 'RU_014', name: '러시안 룰렛', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'russianRoulette', shots: 6, bulletChance: 64, damage: 25 }],
        description: '최대 6번 도박. 각 발마다 [성공: 36%] 25 피해 후 계속. [총알: 64%] 체력 절반 잃고 중단.'
    },
    {
        id: 'RU_015', name: '보험 가입', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'buffInsurance' }],
        description: '이번 턴 불운 발생 시마다 방어도 10 획득.'
    },
    {
        id: 'RU_016', name: '주사위 깎기', pack: 'russian_roulette',
        type: 'skill', rarity: 'epic', tier: 2, cost: 0,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 100, thenEffects: [{ type: 'addLuck', value: 3 }] }],
        description: '[도박: 100%] 행운: 행운 스택 3 획득.'
    },
    {
        id: 'RU_017', name: '확률 보정', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'nextGambleBonusChance', value: 10 }],
        description: '다음 도박 카드의 확률 10% 증가.'
    },
    {
        id: 'RU_018', name: '올인 선언', pack: 'russian_roulette',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['gamble'],
        effects: [
            { type: 'discardAll' },
            { type: 'drainEnergy' },
            {
                type: 'gamble', chance: 40,
                thenEffects: [{ type: 'restoreMaxEnergy' }, { type: 'draw', value: 5 }],
                elseEffects: [{ type: 'endTurn' }]
            }
        ],
        description: '손패 전부 버리고 에너지 전량 소모. [도박: 40%] 행운: 에너지 최대 회복 + 5장 드로우. 불운: 턴 강제 종료.'
    },
    {
        id: 'RU_019', name: '소매치기', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 33, thenEffects: [{ type: 'stealShield', mode: 'halfSteal' }], elseEffects: [{ type: 'selfDamageByTargetShield' }] }],
        description: '[도박: 33%] 행운: 적 방어도 50% 훔침. 불운: 적 방어도만큼 자해.'
    },
    {
        id: 'RU_020', name: '럭키 세븐', pack: 'russian_roulette',
        type: 'power', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [],
        powerEffect: { type: 'energyOnFirstLuck' },
        description: '매 턴, 첫 행운 발동 시 행운 스택 1, 에너지 1 획득.'
    },
    // Tier 3 (10장)
    {
        id: 'RU_021', name: '풀하우스 난타', pack: 'russian_roulette',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'fullHouseHit' }],
        description: '6 피해를 5번. 각 타격마다 [도박: 50%] 행운: 데미지 2배.'
    },
    {
        id: 'RU_022', name: '사기 도박', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'damageByLuckStack', multiplier: 5 }],
        description: '행운 스택 x5 만큼 피해.'
    },
    {
        id: 'RU_023', name: '블라인드 스나이핑', pack: 'russian_roulette',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 22, thenEffects: [{ type: 'damageMaxPercent', value: 0.5, limit: 200 }], elseEffects: [{ type: 'damage', value: 1 }] }],
        description: '[도박: 22%] 행운: 적 체력 50% 피해(최대 200). 불운: 1 피해.'
    },
    {
        id: 'RU_024', name: '카르마 슬래시', pack: 'russian_roulette',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 10 }, { type: 'damagePlusByLuckyThisBattle', multiplier: 5 }, { type: 'damagePlusByUnluckyThisBattle', multiplier: 10 }],
        description: '적에게 10 피해. 이번 전투에서 행운이 성공한 횟수 당 데미지가 5, 불운이 발생한 횟수 당 데미지가 10 증가합니다'
    },
    {
        id: 'RU_025', name: '운수 좋은 날', pack: 'russian_roulette',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'retryGambleOnUnluck' }],
        description: '이번 턴 도박 카드 불운 발생 시 그 카드를 한 번 더 사용.'
    },
    {
        id: 'RU_026', name: '황금 칩', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }, { type: 'discardTopAndGainShieldByCost' }],
        description: '카드를 2장 뽑습니다. 내 덱 가장 위에 있는 카드를 버리고, 그 카드의 코스트 * 행운 스택 만큼 방어도를 얻습니다.'
    },
    {
        id: 'RU_027', name: '카드 셔플', pack: 'russian_roulette',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: ['gamble'],
        effects: [{ type: 'reshuffleAndDraw', value: 3 }],
        description: '손패+덱을 섞고 3장 뽑습니다'
    },
    {
        id: 'RU_028', name: '잭팟 슬롯', pack: 'russian_roulette',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 33, thenEffects: [{ type: 'doubleLuck' }], elseEffects: [{ type: 'loseAllLuck' }] }],
        description: '[도박: 33%] 행운: 내 행운 스택이 2배가 됩니다. 불운: 내 모든 행운 스택을 잃습니다.'
    },
    {
        id: 'RU_029', name: '확률론의 지배자', pack: 'russian_roulette',
        type: 'power', rarity: 'epic', tier: 3, cost: 1,
        keywords: [],
        effects: [],
        powerEffect: { type: 'strengthPerLuck' },
        description: '행운 스택 1당 힘 1 증가.'
    },
    {
        id: 'RU_030', name: '포춘 테이블', pack: 'russian_roulette',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'drawOnLuckyChance' },
        description: '행운 발동 시마다 33% 확률로 1장 드로우'
    },
    // Tier 4~5 (10장)
    {
        id: 'RU_031', name: '로얄 스트레이트 플러시', pack: 'russian_roulette',
        type: 'attack', rarity: 'legendary', tier: 4, cost: 5,
        keywords: [],
        effects: [{ type: 'damage', value: 130 }],
        protocolCondition: { type: 'luckMin', value: 10 },
        description: '130 피해. 행운 10 이상이면 코스트 0.'
    },
    {
        id: 'RU_032', name: '운명의 데스 크로스', pack: 'russian_roulette',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'gambleDeathCross' }],
        description: '체력차 절댓값 데미지. [도박: 30%] 행운: 2배. 불운: 내가 입음.'
    },
    {
        id: 'RU_033', name: '미라클 샷', pack: 'russian_roulette',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'damageIfConsecutiveLuck', base: 35, scale: 3, required: 3 }],
        description: '35 피해. 이 턴 도박 누적 성공 3회 이상 시 (35+힘)×3 피해.'
    },
    {
        id: 'RU_034', name: '신의 주사위', pack: 'russian_roulette',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 2,
        keywords: ['gamble'],
        effects: [{ type: 'gamble', chance: 3, thenEffects: [{ type: 'setEnemyHpScale', value: 0 }], elseEffects: [{ type: 'setHpScale', value: 0 }] }],
        description: '[도박: 3%] 행운: 적 체력 1. 불운: 내 체력 1.'
    },
    {
        id: 'RU_035', name: '카지노 로얄', pack: 'russian_roulette',
        type: 'skill', rarity: 'unique', tier: 5, cost: 3,
        keywords: [],
        effects: [{ type: 'casinoRoyalFieldReset' }],
        description: '모든 방어도/디버프/스택 초기화. 양쪽 체력 50% 회복.'
    },
    {
        id: 'RU_036', name: '동전의 양면', pack: 'russian_roulette',
        type: 'skill', rarity: 'unique', tier: 5, cost: 0,
        keywords: ['gamble'],
        effects: [
            { type: 'setHpScale', value: 0.5 },
            { type: 'gamble', chance: 50, thenEffects: [{ type: 'coinFlipHeads' }], elseEffects: [] }
        ],
        description: '체력을 절반으로 감소. [도박 50%] 앞면: 잃은 체력만큼 방어도. 뒷면: 그대로 끝.'
    },
    {
        id: 'RU_037', name: '도박빚 탕감 계약', pack: 'russian_roulette',
        type: 'skill', rarity: 'unique', tier: 5, cost: 1,
        keywords: [],
        effects: [{ type: 'gambleDebt' }],
        description: '손패 모든 [도박] 카드 코스트 0. 턴 종료 시 사용한 도박 확률 합계의 절반만큼 자해.'
    },
    {
        id: 'RU_038', name: '대박의 징조', pack: 'russian_roulette',
        type: 'power', rarity: 'unique', tier: 5, cost: 1,
        keywords: [],
        effects: [],
        powerEffect: { type: 'randomBuffStart' },
        description: '턴 시작 시 무작위 버프(힘5/에너지2/드로우3) 1개.'
    },
    {
        id: 'RU_039', name: '파산 선고', pack: 'russian_roulette',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'bankruptcy' },
        description: '에너지 부족해도 카드 사용 가능. 부족 1당 체력 10 소모.'
    },
    {
        id: 'RU_040', name: '운명의 룰렛 지배자', pack: 'russian_roulette',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'rouletteMaster' },
        description: '행운이 발생하면 행운 스택을 2만큼 획득합니다. 불운 발생 시 그 카드의 코스트만큼 **행운** 스택을 획득합니다'
    }
]);
