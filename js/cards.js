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
    totalCards: 26
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
        effects: [{ type: 'shieldBreak', value: 5 }, { type: 'damage', value: 8 }],
        description: '적의 방어도를 5 깎고, 8의 피해를 줍니다.'
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
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'heal', value: 12 }],
        description: '내 체력을 12 회복합니다.'
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
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }],
        description: '카드를 2장 뽑습니다.'
    },
    {
        id: 'BASE_010', name: '약점 스캔', pack: 'base',
        type: 'skill', rarity: 'common', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'strength', value: 1 }, { type: 'draw', value: 1 }],
        description: '내게 힘을 1 부여하고 카드를 1장 뽑습니다.'
    },
    // === Tier 2 (4장) ===
    {
        id: 'BASE_011', name: '전력 재분배', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'energy', value: 2 }], // 단순화: 이번 턴 에너지 2
        description: '에너지를 2 얻습니다.'
    },
    {
        id: 'BASE_012', name: '시야 교란 먼지', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'weakness', value: 2 }],
        description: '적에게 약화를 2 부여합니다.'
    },
    {
        id: 'BASE_013', name: '긴급 회피', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'draw', value: 1 }],
        extractEffects: [{ type: 'shield', value: 10 }],
        description: '카드를 1장 뽑습니다. 추출: 방어도 10을 얻습니다.'
    },
    {
        id: 'BASE_014', name: '전면 방어 전개', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'shield', value: 18 }],
        description: '18의 방어도를 얻습니다.'
    },
    // === Tier 3 (4장) ===
    {
        id: 'BASE_015', name: '무차별 난사', pack: 'base',
        type: 'attack', rarity: 'rare', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'damage', value: 5, hits: 4 }],
        description: '적에게 5의 피해를 4번 줍니다.'
    },
    {
        id: 'BASE_016', name: '시스템 정화', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'heal', value: 5 }],
        description: '상태이상 제거 후 체력을 5 회복합니다.'
    },
    {
        id: 'BASE_017', name: '생존 본능', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 3, cost: 0,
        keywords: [],
        effects: [{
            type: 'conditional',
            condition: { type: 'hpBelow', value: 30 },
            thenEffects: [{ type: 'shield', value: 30 }],
            elseEffects: [{ type: 'shield', value: 15 }]
        }],
        description: '방어도 15. 체력 30% 이하면 방어도 30.'
    },
    {
        id: 'BASE_018', name: '전술적 후퇴', pack: 'base',
        type: 'skill', rarity: 'rare', tier: 3, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 8 }, { type: 'draw', value: 1 }],
        description: '방어도를 얻고 카드를 1장 뽑습니다.'
    },
    // === Tier 4 (4장) ===
    {
        id: 'BASE_019', name: '결정적 일격', pack: 'base',
        type: 'attack', rarity: 'epic', tier: 4, cost: 3,
        keywords: [],
        effects: [{ type: 'damage', value: 40 }],
        description: '적에게 40의 피해를 줍니다.'
    },
    {
        id: 'BASE_020', name: '중장갑 기동', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'shield', value: 15 }, { type: 'strength', value: 3 }],
        description: '15의 방어도와 다음 공격에 10 추가 피해.'
    },
    {
        id: 'BASE_021', name: '에너지 전환', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 1,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }],
        description: '카드를 2장 뽑습니다.'
    },
    {
        id: 'BASE_022', name: '비상 동력원', pack: 'base',
        type: 'skill', rarity: 'epic', tier: 4, cost: 0,
        keywords: [],
        effects: [{ type: 'energy', value: 2 }],
        description: '이번 턴에 에너지를 2 얻습니다.'
    },
    // === Tier 5 (4장) ===
    {
        id: 'BASE_023', name: '만능 조커 패스', pack: 'base',
        type: 'skill', rarity: 'unique', tier: 5, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 2 }, { type: 'energy', value: 2 }],
        description: '카드 2장 드로우, 코스트 0으로 사용.'
    },
    {
        id: 'BASE_024', name: '전술 지휘 체계', pack: 'base',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraDraw', value: 1 },
        description: '매 턴 드로우 +1.'
    },
    {
        id: 'BASE_025', name: '아드레날린 펌프', pack: 'base',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraEnergy', value: 1 },
        description: '매 턴 에너지 +1.'
    },
    {
        id: 'BASE_026', name: '한계 돌파 훈련', pack: 'base',
        type: 'power', rarity: 'unique', tier: 5, cost: 3,
        keywords: [],
        effects: [],
        powerEffect: { type: 'strengthOnManyCards', threshold: 4, value: 1 },
        description: '한 턴에 카드 4장 이상 사용 시 힘 +1.'
    }
]);

// ─── 오버클럭 코어 팩 (40장 = 45 - 공용 5장) ───
registerPack('overclock', {
    name: '오버클럭 코어 팩',
    description: '자해, 과부하, 딜 펌핑 설계. 오버클럭 스택으로 화력 극대화.',
    totalCards: 45
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'OC_006', name: '피를 머금은 톱니', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'selfDamage', value: 2 }, { type: 'damage', value: 12 }],
        description: '오버클럭: 자해 2, 적에게 12 피해.'
    },
    {
        id: 'OC_007', name: '우회 타격', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock', 'dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: true }, { type: 'damage', value: 7 }],
        description: '오버클럭: 무작위 해체 1, 적에게 7 피해.'
    },
    {
        id: 'OC_008', name: '단기출력 펀치', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['overclock'],
        effects: [
            { type: 'selfDamage', value: 5 },
            {
                type: 'conditional',
                condition: { type: 'hpBelow', value: 50 },
                thenEffects: [{ type: 'damage', value: 20 }],
                elseEffects: [{ type: 'damage', value: 14 }]
            }
        ],
        description: '오버클럭: 자해 5. 체력 50% 이하면 20, 아니면 14 피해.'
    },
    {
        id: 'OC_009', name: '배터리 스매시', pack: 'overclock',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overload', value: 1 }, { type: 'damage', value: 11 }],
        description: '오버클럭: 과부하(1), 적에게 11 피해.'
    },
    {
        id: 'OC_010', name: '비상 전력 가동', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['overclock'],
        effects: [{ type: 'selfDamage', value: 3 }, { type: 'energy', value: 1 }],
        description: '오버클럭: 자해 3, 에너지 1 획득.'
    },
    {
        id: 'OC_011', name: '초단기 스파크', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['overclock', 'dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: false }, { type: 'energy', value: 1 }],
        description: '오버클럭: 카드 1장 해체, 에너지 1.'
    },
    {
        id: 'OC_012', name: '임시 방열판', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overclockReduce', value: 1 }, { type: 'draw', value: 2 }, { type: 'dismantle', value: 1, random: true }],
        description: '오버클럭 스택 -1, 카드 2장 드로우, 1장 해체.'
    },
    {
        id: 'OC_013', name: '위험한 추진력', pack: 'overclock',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'selfDamage', value: 8 }],
        description: '카드 1장 드로우, 체력 8 감소.'
    },
    {
        id: 'OC_014', name: '땜질된 회로', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'maxHpReduce', value: 5 }, { type: 'draw', value: 2 }],
        description: '최대 체력 5 감소, 카드 2장 드로우.'
    },
    {
        id: 'OC_015', name: '예열 일격', pack: 'overclock',
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
        id: 'OC_016', name: '리미터 해제 타격', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['overclock'],
        effects: [
            { type: 'selfDamage', value: 3 },
            { type: 'scaledDamage', value: 8, scaling: { source: 'selfDamageThisTurn', multiplier: 2 } }
        ],
        description: '오버클럭: 자해 3. 이번 턴 자해량×2 추가 피해.'
    },
    {
        id: 'OC_017', name: '고압 전류 방출', pack: 'overclock',
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
        id: 'OC_018', name: '목숨 건 참격', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 35 }, { type: 'selfDamage', value: 12 }],
        description: '적에게 35 피해. 체력 12 자해.'
    },
    {
        id: 'OC_019', name: '과열된 총신', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 2, cost: 3,
        keywords: ['overclock'],
        effects: [{ type: 'damage', value: 40 }, { type: 'overclockReduce', value: 1 }, { type: 'overload', value: 1 }],
        description: '40 피해, 오버클럭 -1, 과부하(1).'
    },
    {
        id: 'OC_020', name: '위험 수위 돌파', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'damage', value: 8, hits: 3 }, { type: 'weakness', value: 2 }],
        description: '8의 피해 ×3. 약화 2 자가 부여.'
    },
    {
        id: 'OC_021', name: '코어 강제 주입', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'selfDamage', value: 12 }, { type: 'energy', value: 3 }, { type: 'overload', value: 1 }],
        description: '자해 12, 에너지 3, 과부하(1).'
    },
    {
        id: 'OC_022', name: '불안정한 장갑판', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 12 }],
        description: '12의 방어도 (턴 종료 시 소멸).'
    },
    {
        id: 'OC_023', name: '전력 과소비', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['overclock'],
        effects: [{ type: 'draw', value: 3 }, { type: 'overload', value: 1 }, { type: 'overclockGain', value: 2 }],
        description: '3장 드로우, 과부하(1), 오버클럭 +2.'
    },
    {
        id: 'OC_024', name: '수동 쿨다운', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledShield', value: 0, scaling: { source: 'overclockConsumed', multiplier: 5 } }],
        description: '오버클럭 스택 全소모, 소모한 스택 ×5 방어도.'
    },
    {
        id: 'OC_025', name: '한계 돌파 태세', pack: 'overclock',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'overclockPerTurn', value: 1, energyCost: 1 },
        description: '매 턴 에너지 1 잃고 오버클럭 +1.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'OC_026', name: '과전류 방출', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['overclock'],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledDamage', value: 0, scaling: { source: 'overclockConsumed', multiplier: 25 } }, { type: 'overload', value: 1 }],
        description: '오버클럭 全소모, 스택당 25 피해, 과부하(1).'
    },
    {
        id: 'OC_027', name: '멜트다운 스트라이크', pack: 'overclock',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['overclock'],
        effects: [{ type: 'damage', value: 80 }, { type: 'maxHpReduce', value: 15 }],
        description: '80 피해, 최대 체력 15 감소.'
    },
    {
        id: 'OC_028', name: '수명 단축 빔', pack: 'overclock',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'maxHpReduce', value: 4 }, { type: 'damage', value: 14 }],
        description: '오버클럭: 최대 체력 4 감소, 14 피해.'
    },
    {
        id: 'OC_029', name: '긴급 냉각 펄스', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'overclockConsume' }, { type: 'scaledShield', value: 0, scaling: { source: 'overclockConsumed', multiplier: 15 } }],
        description: '오버클럭 全소모, 스택당 15 방어도.'
    },
    {
        id: 'OC_030', name: '냉각수 배출', pack: 'overclock',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 1, random: false }],
        description: '카드 1장 선택 해체, 과부하 1 감소.'
    },
    {
        id: 'OC_031', name: '리스크 청산', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'heal', value: 35 }, { type: 'maxHpReduce', value: 2 }],
        description: '체력 35 회복, 최대 체력 2 감소.'
    },
    {
        id: 'OC_032', name: '임계점 도달', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overcurrent'],
        effects: [{
            type: 'conditional',
            condition: { type: 'overclockMin', value: 4 },
            thenEffects: [{ type: 'draw', value: 3 }, { type: 'energy', value: 2 }],
            elseEffects: [{ type: 'draw', value: 1 }]
        }],
        description: '과전류(4): 3장 드로우 + 에너지 2. 미달 시 1장.'
    },
    {
        id: 'OC_033', name: '강제 각성', pack: 'overclock',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['overclock'],
        effects: [{ type: 'selfDamage', value: 20 }, { type: 'overclockGain', value: 3 }],
        description: '자해 20, 오버클럭 +3.'
    },
    {
        id: 'OC_034', name: '안전 모드 전환', pack: 'overclock',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'healOnHighOverclock', threshold: 3, value: 10 },
        description: '턴 종료 시 오버클럭 3+ 이면 스택-1, 체력 10 회복.'
    },
    {
        id: 'OC_035', name: '고위험 고수익 프로토콜', pack: 'overclock',
        type: 'power', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'shieldOnOverclock', value: 3, maxPerTurn: 5 },
        description: '오버클럭 카드 사용 시 방어도 3 (턴당 최대 5회).'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'OC_036', name: '묵직한 막타', pack: 'overclock',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'scaledDamage', value: 45, scaling: { source: 'targetLostHp', multiplier: 0.1, max: 100 } }],
        description: '45 피해 + 적 잃은 체력 10% 추가(최대 100).'
    },
    {
        id: 'OC_037', name: '초신성 폭발', pack: 'overclock',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 4,
        keywords: ['overcurrent', 'overclock'],
        effects: [
            { type: 'overload', value: 2 },
            { type: 'overclockConsume' },
            { type: 'scaledDamage', value: 150, scaling: { source: 'overclockConsumed', multiplier: 50 } }
        ],
        description: '과전류(3), 과부하(2). 150 피해 + 오버클럭 스택당 50 추가 피해.'
    },
    {
        id: 'OC_038', name: '오버 드라이브 코어', pack: 'overclock',
        type: 'attack', rarity: 'unique', tier: 4, cost: 6,
        keywords: ['overclock'],
        effects: [{ type: 'damage', value: 100 }],
        description: '100 피해 (오버클럭 스택에 따라 코스트 감소).'
    },
    {
        id: 'OC_039', name: '냉각팬 증설', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['overclock', 'rebuild'],
        rebuildCount: 2,
        effects: [{ type: 'overclockReduce', value: 1 }, { type: 'draw', value: 1 }],
        description: '재구축(2). 오버클럭 -1, 카드 1장 드로우.'
    },
    {
        id: 'OC_040', name: '절대 영도 펄스', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: [],
        effects: [{ type: 'shield', value: 15 }, { type: 'weakness', value: 2 }],
        description: '이번 턴 자해 2회 방어 + 약화 2.'
    },
    {
        id: 'OC_041', name: '운명 거스르기', pack: 'overclock',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: ['overcurrent'],
        effects: [{ type: 'scaledDamage', value: 0, scaling: { source: 'selfDamageThisTurn', multiplier: 1 } }],
        description: '과전류(2). 이번 턴 받은 모든 피해만큼 적에게 피해.'
    },
    {
        id: 'OC_042', name: '모든 제한 해제', pack: 'overclock',
        type: 'power', rarity: 'legendary', tier: 5, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'removeOverclockLimit' },
        description: '오버클럭 스택 최대치 해제, 턴 종료 시 감소 없음.'
    },
    {
        id: 'OC_043', name: '영구 기관 코어', pack: 'overclock',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'fixedDemerit' },
        description: '오버클럭 디메리트 수치를 기본값으로 고정.'
    },
    {
        id: 'OC_044', name: '불멸의 사이보그', pack: 'overclock',
        type: 'power', rarity: 'unique', tier: 4, cost: 4,
        keywords: [],
        effects: [],
        powerEffect: { type: 'reviveOnce', value: 50 },
        description: '체력 0 시 1회 50% 회복 부활.'
    },
    {
        id: 'OC_045', name: '광기의 톱니바퀴', pack: 'overclock',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['overclock'],
        effects: [],
        powerEffect: { type: 'damageOnSelfDamage' },
        description: '자해/오버클럭 카드 사용 시 리스크값만큼 적에게 추가 피해.'
    }
]);

// ─── 해체/재구축 팩 (40장 = 45 - 공용 5장) ───
registerPack('dismantle', {
    name: '해체/재구축 팩',
    description: '해체(버림), 추출(버려질 때 효과), 재구축(반복 사용) 시너지',
    totalCards: 45
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'DM_006', name: '고철 던지기', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 7 }, { type: 'dismantle', value: 1, random: false }],
        description: '7 피해, 카드 1장 선택 해체.'
    },
    {
        id: 'DM_007', name: '맹목적 사격', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 5 }],
        extractEffects: [{ type: 'damage', value: 7 }],
        description: '5 피해. 추출: 7 피해.'
    },
    {
        id: 'DM_008', name: '분해 타격', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 12 }, { type: 'dismantle', value: 1, random: true }, { type: 'draw', value: 2 }],
        description: '12 피해, 무작위 1장 해체, 2장 드로우.'
    },
    {
        id: 'DM_009', name: '스크랩 소드', pack: 'dismantle',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 8 }],
        extractEffects: [{ type: 'damage', value: 10 }, { type: 'strength', value: 1 }],
        description: '8 피해. 추출: 10 피해 + 다음 공격 +3.'
    },
    {
        id: 'DM_010', name: '불법 복제', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 2 }, { type: 'dismantle', value: 1, random: true }],
        description: '2장 드로우, 무작위 1장 해체.'
    },
    {
        id: 'DM_011', name: '데이터 백업', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'shield', value: 5 }],
        extractEffects: [{ type: 'shield', value: 8 }],
        description: '방어도 5. 추출: 방어도 8.'
    },
    {
        id: 'DM_012', name: '임시 땜빵', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 2,
        effects: [{ type: 'shield', value: 6 }],
        description: '재구축(2). 방어도 6.'
    },
    {
        id: 'DM_013', name: '부품 색출', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 3 }, { type: 'dismantle', value: 2, random: false }],
        description: '3장 드로우, 2장 선택 해체.'
    },
    {
        id: 'DM_014', name: '긴급 탈출', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 1 }],
        description: '덱에서 스킬 1장 서치, 이번 턴 코스트 0.'
    },
    {
        id: 'DM_015', name: '불량 배터리', pack: 'dismantle',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 1 }, { type: 'dismantle', value: 1, random: true }],
        description: '1장 드로우, 무작위 1장 해체.'
    },
    // === Tier 2 (10장) ===
    {
        id: 'DM_016', name: '재활용 프레스', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 15 }, { type: 'energy', value: 1 }],
        description: '15 피해, 이번 턴에 해체한 카드 있으면 에너지 1.'
    },
    {
        id: 'DM_017', name: '폐기물 폭격', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 4, hits: 4 }, { type: 'dismantle', value: 1, random: true }],
        description: '4×4 피해, 무작위 1장 해체.'
    },
    {
        id: 'DM_018', name: '백도어 찌르기', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['extract'],
        effects: [{ type: 'damage', value: 6 }],
        extractEffects: [{ type: 'damage', value: 9 }, { type: 'heal', value: 5 }],
        description: '6 피해. 추출: 9 피해 + 상태이상 1개 제거.'
    },
    {
        id: 'DM_019', name: '나노머신 톱', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 2, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 3,
        effects: [{ type: 'damage', value: 10 }],
        description: '재구축(3). 10 피해.'
    },
    {
        id: 'DM_020', name: '과부하 색출', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 3, random: false }, { type: 'draw', value: 3 }],
        description: '최대 3장 선택 해체, 해체 수만큼 드로우.'
    },
    {
        id: 'DM_021', name: '불연속 회피', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['extract'],
        effects: [{ type: 'shield', value: 10 }],
        extractEffects: [{ type: 'shield', value: 30 }],
        description: '방어도 10. 추출: 피해 절반.'
    },
    {
        id: 'DM_022', name: '메모리 최적화', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 3 }],
        description: '모든 카드 해체 후 같은 수만큼 드로우.'
    },
    {
        id: 'DM_023', name: '부품 조립', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 1,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 1 }],
        description: '덱에서 공격 카드 1장 서치, 이번 턴 코스트 0.'
    },
    {
        id: 'DM_024', name: '방화벽 재구축', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['extract'],
        effects: [{ type: 'shield', value: 12 }],
        extractEffects: [{ type: 'shield', value: 12 }],
        description: '방어도 12. 추출: 방어도 12 + 다음 턴 패 복귀.'
    },
    {
        id: 'DM_025', name: '스크랩 수집가', pack: 'dismantle',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'damageOnDismantle', value: 1 },
        description: '해체할 때마다 적에게 1 피해.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'DM_026', name: '리사이클 빔', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['rebuild'],
        effects: [{ type: 'damage', value: 20 }],
        description: '20 피해 (재구축 발동 시 피해 +5 성장).'
    },
    {
        id: 'DM_027', name: '데이터 파쇄', pack: 'dismantle',
        type: 'attack', rarity: 'rare', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 2, random: false }, { type: 'shieldBreak', value: 16 }, { type: 'damage', value: 16 }],
        description: '2장 해체, 해체당 방어도 8 깨고 8 피해.'
    },
    {
        id: 'DM_028', name: '쓰레기통 투척', pack: 'dismantle',
        type: 'attack', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['dismantle'],
        effects: [{ type: 'scaledDamage', value: 0, scaling: { source: 'dismantledThisBattle', multiplier: 3 } }],
        description: '이번 전투 총 해체 수 ×3 피해.'
    },
    {
        id: 'DM_029', name: '블랙마켓 거래', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['dismantle'],
        effects: [{ type: 'selfDamage', value: 8 }, { type: 'draw', value: 1 }, { type: 'dismantle', value: 2, random: true }],
        description: '자해 8, 덱 탑 3장 중 1장 선택, 나머지 해체.'
    },
    {
        id: 'DM_030', name: '무한 동력 수배', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: ['extract'],
        effects: [{ type: 'energy', value: 1 }],
        extractEffects: [{ type: 'energy', value: 1 }],
        description: '이번 턴 추출 발동 시마다 에너지 1 (최대 3회).'
    },
    {
        id: 'DM_031', name: '강제 데이터 덤프', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'shield', value: 30 }],
        description: '모든 패 해체, 해체당 방어도 10.'
    },
    {
        id: 'DM_032', name: '예비품 가동', pack: 'dismantle',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 1,
        effects: [{ type: 'draw', value: 1 }],
        description: '재구축(1). 덱에서 파워/스킬 1장 서치, 코스트 -1.'
    },
    {
        id: 'DM_033', name: '스크랩 실드', pack: 'dismantle',
        type: 'skill', rarity: 'rare', tier: 3, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'scaledShield', value: 0, scaling: { source: 'dismantledCount', multiplier: 3 } }],
        description: '이번 전투 해체 총 수 ×1 방어도.'
    },
    {
        id: 'DM_034', name: '고효율 파쇄기', pack: 'dismantle',
        type: 'power', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'drawOnDismantle', threshold: 5, value: 1 },
        description: '카드 5장 해체 시마다 1장 드로우.'
    },
    {
        id: 'DM_035', name: '재구축 프로토콜', pack: 'dismantle',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['rebuild'],
        effects: [],
        powerEffect: { type: 'rebuildBonus', value: 1 },
        description: '모든 재구축 횟수 +1.'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'DM_036', name: '가비지 콜렉터', pack: 'dismantle',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 45 }],
        description: '45 피해. 이번 턴 3장+ 해체 시 무작위 카드에 재구축(1).'
    },
    {
        id: 'DM_037', name: '차원 파쇄포', pack: 'dismantle',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 4,
        keywords: ['dismantle'],
        effects: [{ type: 'damage', value: 150 }, { type: 'dismantle', value: 5, random: true }],
        description: '150 피해, 덱 위 5장 해체.'
    },
    {
        id: 'DM_038', name: '정크 골렘 강림', pack: 'dismantle',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['rebuild', 'dismantle', 'extract'],
        rebuildCount: 1,
        effects: [{ type: 'damage', value: 40 }, { type: 'dismantle', value: 1, random: true }],
        extractEffects: [{ type: 'selfDamage', value: 10 }],
        description: '재구축(1). 40 피해 + 무작위 1장 해체.'
    },
    {
        id: 'DM_039', name: '시스템 롤백', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 5 }],
        description: '모든 패 해체 후 직전 턴 패 재생성.'
    },
    {
        id: 'DM_040', name: '등가 교환 연성 진', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['dismantle'],
        effects: [{ type: 'dismantle', value: 3, random: false }, { type: 'draw', value: 2 }, { type: 'energy', value: 2 }],
        description: '3장 선택 해체, 공격/파워 2장 서치 + 코스트 0.'
    },
    {
        id: 'DM_041', name: '쓰레기통 기적', pack: 'dismantle',
        type: 'skill', rarity: 'unique', tier: 4, cost: 0,
        keywords: ['dismantle'],
        effects: [{
            type: 'conditional',
            condition: { type: 'dismantledThisTurn', value: 15 },
            thenEffects: [{ type: 'heal', value: 30 }, { type: 'energy', value: 3 }],
            elseEffects: []
        }],
        description: '전투 동안 15장+ 해체 시 체력 30% 회복 + 에너지 3.'
    },
    {
        id: 'DM_042', name: '극한의 압축 설계', pack: 'dismantle',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 1,
        keywords: ['rebuild'],
        rebuildCount: 4,
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 1 }],
        description: '재구축(4). 카드 1장 드로우 + 재구축(1) 부여.'
    },
    {
        id: 'DM_043', name: '블랙홀 분쇄기', pack: 'dismantle',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['dismantle'],
        effects: [],
        powerEffect: { type: 'energyAndDrawOnFirstDismantle', energy: 2, draw: 2 },
        description: '매 턴 최초 해체 시 에너지 2 + 2장 드로우.'
    },
    {
        id: 'DM_044', name: '영구기관 조립기', pack: 'dismantle',
        type: 'power', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['rebuild'],
        effects: [],
        powerEffect: { type: 'healAndCostReductionOnRebuild', heal: 10, costReduction: 1 },
        description: '재구축 복귀 시 코스트 -1 + 체력 10 회복.'
    },
    {
        id: 'DM_045', name: '무한의 츠쿠요미', pack: 'dismantle',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['rebuild'],
        effects: [],
        powerEffect: { type: 'damageOnRebuild', multiplier: 5 },
        description: '재구축 시 총 재구축 횟수 ×5 고정 데미지.'
    }
]);

// ─── 네트워크 프로토콜 팩 (40장 = 45 - 공용 5장) ───
registerPack('network', {
    name: '네트워크 프로토콜 팩',
    description: '네트워크(스택) 누적과 프로토콜[조건] 연계 시너지. 카드 연쇄 콤보.',
    totalCards: 45
});

registerCards([
    // === Tier 1 전용 (10장) ===
    {
        id: 'NW_006', name: '핑(Ping) 전송', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 0,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 3, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '3 + n×1 피해. [네트워크]'
    },
    {
        id: 'NW_007', name: '패킷 강타', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledDamage', value: 5, scaling: { source: 'networkStacks', multiplier: 2 } }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'draw', value: 1 }],
        description: '5 + n×2 피해. 프로토콜[네트워크]: 1장 드로우.'
    },
    {
        id: 'NW_008', name: '연쇄 절단', pack: 'network',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 6 }],
        protocolCondition: 'attack',
        protocolEffects: [{ type: 'damage', value: 6 }],
        description: '6 피해. 프로토콜[공격]: 추가 6 피해.'
    },
    {
        id: 'NW_009', name: '트래픽 마비', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 10, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '10 + n×2 피해. [네트워크]'
    },
    {
        id: 'NW_010', name: '노드 접속', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'draw', value: 1 }, { type: 'scaledDamage', value: 1, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '1장 드로우, 1 + n×1 피해. [네트워크]'
    },
    {
        id: 'NW_011', name: '방화벽 재할당', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledShield', value: 5, scaling: { source: 'networkStacks', multiplier: 1 } }],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'shield', value: 5 }],
        description: '5 + n×1 방어도. 프로토콜[스킬]: 추가 방어도 5.'
    },
    {
        id: 'NW_012', name: '서브루틴 가동', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['network'],
        effects: [{ type: 'protocolBypass', value: 1 }, { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '0 + n×1 방어도. 다음 카드 프로토콜 자동 충족. [네트워크]'
    },
    {
        id: 'NW_013', name: '백그라운드 핑', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'energy', value: 1 }, { type: 'draw', value: 1 }],
        description: '에너지 1, 카드 1장 드로우.'
    },
    {
        id: 'NW_014', name: '라우팅 최적화', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 1 }],
        description: '무작위 카드 최대 3장 코스트 1 감소. [네트워크]'
    },
    {
        id: 'NW_015', name: '우회 접속', pack: 'network',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }],
        description: '덱에서 [네트워크] 카드 1장 서치.'
    },
    // === Tier 2 (10장) ===
    {
        id: 'NW_016', name: '동기화 타격', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 8 }],
        protocolCondition: 'power',
        protocolEffects: [{ type: 'damage', value: 8 }, { type: 'energy', value: 1 }],
        description: '8 피해. 프로토콜[파워]: 코스트 0 + 피해 2배.'
    },
    {
        id: 'NW_017', name: '악성 루프', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['network', 'rebuild', 'protocol'],
        rebuildCount: 2,
        effects: [{ type: 'scaledDamage', value: 5, scaling: { source: 'networkStacks', multiplier: 2 } }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'virus', value: 1 }],
        description: '재구축(2). 5 + n×2 피해. 프로토콜[네트워크]: 바이러스(1).'
    },
    {
        id: 'NW_018', name: '디도스(DDoS) 폭격', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 3, hits: 5 }],
        protocolCondition: 'zeroCost',
        protocolEffects: [{ type: 'armorPierce', value: true }],
        description: '3×5 피해. 프로토콜[0코스트]: 방어도 무시.'
    },
    {
        id: 'NW_019', name: '오버플로우 스트라이크', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['network', 'protocol'],
        effects: [{ type: 'scaledDamage', value: 12, scaling: { source: 'networkStacks', multiplier: 2 } }],
        protocolCondition: 'dismantle',
        protocolEffects: [{ type: 'energy', value: 1 }, { type: 'draw', value: 1 }],
        description: '12 + n×2 피해. 프로토콜[해체]: 에너지 1 + 1장 드로우.'
    },
    {
        id: 'NW_020', name: '다중 포트 개방', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'energy', value: 2 }, { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 1 } }],
        description: '에너지 2, n×1 방어도. [네트워크] 3장 미만 사용 시 자해 5.'
    },
    {
        id: 'NW_021', name: '데이터 클로닝', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 1 }],
        description: '손패 카드 1장 선택, 이번 턴 코스트 0.'
    },
    {
        id: 'NW_022', name: '패킷 가로채기', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'shield', value: 8 }],
        protocolCondition: 'skill',
        protocolEffects: [{ type: 'shield', value: 8 }],
        description: '적 피해 20% 방어도. 프로토콜[스킬]: 40%.'
    },
    {
        id: 'NW_023', name: '논리 폭탄 세팅', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'weakness', value: 2 }],
        description: '약화 2 부여. 5장 이상 사용 시 에너지 1. [네트워크]'
    },
    {
        id: 'NW_024', name: '매크로 캔슬', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 2, cost: 0,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }],
        description: '턴 종료, 남은 에너지당 1장 드로우.'
    },
    {
        id: 'NW_025', name: '봇넷 지휘소', pack: 'network',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'drawOnNetworkThreshold', threshold: 3, value: 1 },
        description: '매 턴 [네트워크] 3장 사용 시 [네트워크] 카드 1장 서치.'
    },
    // === Tier 3 (10장) ===
    {
        id: 'NW_026', name: '연산력 오버드라이브', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 8, scaling: { source: 'networkStacks', multiplier: 4 } }],
        description: '8 + n×4 피해. [네트워크]'
    },
    {
        id: 'NW_027', name: '페이로드 투하', pack: 'network',
        type: 'attack', rarity: 'epic', tier: 3, cost: 3,
        keywords: [],
        effects: [{
            type: 'conditional',
            condition: { type: 'networkCardsPlayed', value: 3 },
            thenEffects: [{ type: 'damage', value: 60 }],
            elseEffects: [{ type: 'damage', value: 30 }]
        }],
        description: '30 피해. [네트워크] 3장+ 사용 시 60 피해.'
    },
    {
        id: 'NW_028', name: '제로데이 익스플로잇', pack: 'network',
        type: 'attack', rarity: 'rare', tier: 3, cost: 1,
        keywords: ['protocol'],
        effects: [{ type: 'damage', value: 15 }],
        protocolCondition: 'network',
        protocolEffects: [{ type: 'armorPierce', value: true }],
        description: '15 피해. 프로토콜[네트워크]: 방어도 무시.'
    },
    {
        id: 'NW_029', name: '대역폭 증폭', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['network'],
        effects: [{ type: 'protocolBypass', value: 2 }, { type: 'scaledShield', value: 5, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '5 + n×2 방어도. 다음 2장 프로토콜 자동 충족. [네트워크]'
    },
    {
        id: 'NW_030', name: '클라우드 덤프', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 3, cost: 0,
        keywords: ['dismantle'],
        effects: [{ type: 'draw', value: 2 }, { type: 'energy', value: 2 }],
        description: '모든 [네트워크] 카드 해체, 해체 수만큼 드로우 + 에너지 2.'
    },
    {
        id: 'NW_031', name: '시그널 체인', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['network'],
        effects: [{ type: 'draw', value: 3 }, { type: 'scaledShield', value: 0, scaling: { source: 'networkStacks', multiplier: 2 } }],
        description: '3장 드로우(코스트 0) + n×2 방어도. [네트워크]'
    },
    {
        id: 'NW_032', name: '프록시 방어막', pack: 'network',
        type: 'skill', rarity: 'rare', tier: 3, cost: 2,
        keywords: ['protocol'],
        effects: [{ type: 'shield', value: 10 }],
        protocolCondition: 'any',
        protocolEffects: [{ type: 'shield', value: 10 }],
        description: '방어도 10. 다음 프로토콜 발동 시 방어도 10 추가.'
    },
    {
        id: 'NW_033', name: '스레드 동기화', pack: 'network',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1,
        keywords: ['network'],
        effects: [{ type: 'energy', value: 2 }, { type: 'scaledDamage', value: 0, scaling: { source: 'networkStacks', multiplier: 3 } }],
        description: '에너지 2, 코스트 합계 × n 피해. [네트워크]'
    },
    {
        id: 'NW_034', name: '루트 권한 탈취', pack: 'network',
        type: 'power', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'doubleThirdNetwork' },
        description: '매 턴 3번째 [네트워크] 카드 기본 효과 2배.'
    },
    {
        id: 'NW_035', name: '병렬 처리 엔진', pack: 'network',
        type: 'power', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'energyOnCardCount', thresholds: [4, 7, 10], value: 1 },
        description: '카드 4/7/10번째 사용 시 에너지 1.'
    },
    // === Tier 4-5 (10장) ===
    {
        id: 'NW_036', name: '기간 트래픽 충돌', pack: 'network',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['network'],
        effects: [{ type: 'scaledDamage', value: 50, scaling: { source: 'networkStacks', multiplier: 5 } }],
        description: '50 + n×5 피해. [네트워크]'
    },
    {
        id: 'NW_037', name: '아포칼립스 프로토콜', pack: 'network',
        type: 'attack', rarity: 'legendary', tier: 5, cost: 4,
        keywords: ['protocol'],
        effects: [{
            type: 'conditional',
            condition: { type: 'overclockMin', value: 5 },
            thenEffects: [{ type: 'damage', value: 120 }, { type: 'energy', value: 2 }],
            elseEffects: [{ type: 'damage', value: 30 }]
        }],
        description: '30 피해. 축적(5): 에너지 2 + 피해 4배(120).'
    },
    {
        id: 'NW_038', name: '양자 얽힘 스매시', pack: 'network',
        type: 'attack', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'scaledDamage', value: 25, scaling: { source: 'totalDamageThisTurn', multiplier: 0.5 } }],
        description: '25 피해 + 이번 턴 총 피해의 50% 추가.'
    },
    {
        id: 'NW_039', name: '웜바이러스 배양', pack: 'network',
        type: 'skill', rarity: 'unique', tier: 4, cost: 1,
        keywords: ['network'],
        effects: [{
            type: 'conditional',
            condition: { type: 'cardsPlayedThisTurn', value: 4 },
            thenEffects: [{ type: 'draw', value: 4 }],
            elseEffects: [{ type: 'draw', value: 2 }]
        }],
        description: '2장 드로우. 카드 4장+ 사용 시 추가 2장. [네트워크]'
    },
    {
        id: 'NW_040', name: '마스터 오버라이드', pack: 'network',
        type: 'skill', rarity: 'legendary', tier: 5, cost: 3,
        keywords: [],
        effects: [{ type: 'draw', value: 5 }, { type: 'energy', value: 3 }],
        description: '손패 전부 버림, 버린 수만큼 고코스트 카드 서치(코스트 1).'
    },
    {
        id: 'NW_041', name: '초차원 게이트웨이', pack: 'network',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [{ type: 'draw', value: 1 }, { type: 'energy', value: 2 }],
        description: '덱에서 가장 고코스트 카드 서치, 코스트 0.'
    },
    {
        id: 'NW_042', name: '시스템 완전 포맷', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['network'],
        effects: [],
        powerEffect: { type: 'permanentNetworkBuff', damage: 3, shield: 3 },
        description: '모든 [네트워크] 카드 피해/방어도 영구 +3.'
    },
    {
        id: 'NW_043', name: '튜링 완전 신경망', pack: 'network',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: ['protocol'],
        effects: [],
        powerEffect: { type: 'damageAndShieldOnProtocol', damage: 5, shield: 3 },
        description: '프로토콜 달성 시마다 적에게 5 고정 피해 + 방어도 3.'
    },
    {
        id: 'NW_044', name: '글로벌 넷 연결', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 3,
        keywords: [],
        effects: [],
        powerEffect: { type: 'extraDraw', value: 2 },
        description: '기본 드로우 5장 → 7장.'
    },
    {
        id: 'NW_045', name: '사이버 고스트 상태', pack: 'network',
        type: 'power', rarity: 'unique', tier: 4, cost: 2,
        keywords: [],
        effects: [],
        powerEffect: { type: 'energyCarryOver', maxEnergy: 10 },
        description: '남은 에너지 이월 (최대 10).'
    }
]);

// ═══════════════════════════════════════════
// 5. 바이오 해저드 (바이오닉·감염) 팩 (30장)
// ═══════════════════════════════════════════
registerPack('biohazard', {
    name: '바이오 해저드 팩',
    description: '바이러스와 부식으로 적을 좀먹고 폭주로 폭발시키는 팩',
    totalCards: 30
});

registerCards([
    // === Tier 1 (10장) ===
    {
        id: 'BIO_006', name: '감염 주사', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 0,
        keywords: ['virus'],
        effects: [{ type: 'damage', value: 3 }, { type: 'virus', value: 2 }],
        description: '적에게 3의 피해를 주고, 바이러스(2)를 부여합니다.'
    },
    {
        id: 'BIO_007', name: '독성 스크래치', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['virus'],
        effects: [{ type: 'damage', value: 6 }, { type: 'virus', value: 1 }],
        description: '적에게 6의 피해를 주고, 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_008', name: '부식성 타격', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: ['corrosion'],
        effects: [{ type: 'damage', value: 5 }, { type: 'corrosion', value: 1 }],
        description: '적에게 5의 피해를 주고, 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_009', name: '변이체 난사', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'damage', value: 4, hits: 3 },
            { type: 'virus', value: 3 } // 1스택 * 3회 (간편화를 위해 총량 부여)
        ],
        description: '적에게 4의 피해를 3번 줍니다. 각 히트마다 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_010', name: '변이체 배양', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['virus'],
        effects: [{ type: 'virus', value: 3 }, { type: 'draw', value: 1 }],
        description: '바이러스(3)를 부여합니다. 카드를 1장 뽑습니다.'
    },
    {
        id: 'BIO_011', name: '표피 경화', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: ['corrosion'],
        effects: [{ type: 'shield', value: 8 }, { type: 'corrosion', target: 'self', value: 1 }],
        description: '8의 방어도를 얻고, 나에게 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_012', name: '감염 확산', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'consumeVirusForUtility', consume: 3, draw: 2 }],
        description: '폭주(3): 적의 바이러스 스택을 3 소모합니다. 카드를 2장 뽑습니다.'
    },
    {
        id: 'BIO_013', name: '미약한 격발', pack: 'biohazard',
        type: 'attack', rarity: 'common', tier: 1, cost: 1,
        keywords: [],
        effects: [{ type: 'consumeVirusForDamage', consume: 'all', multiplier: 1 }],
        description: '폭주(전부): 적의 바이러스 스택을 전부 소모합니다. 소모한 수치만큼 고정 피해를 줍니다.'
    },
    {
        id: 'BIO_014', name: '생체 신호 교란', pack: 'biohazard',
        type: 'skill', rarity: 'common', tier: 1, cost: 0,
        keywords: ['virus'],
        effects: [{ type: 'weakness', value: 1 }, { type: 'virus', value: 1 }],
        description: '적에게 약화(1)를 부여합니다. 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_015', name: '세포벽 강화', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 1, cost: 2,
        keywords: ['corrosion'],
        effects: [{ type: 'shield', value: 15 }, { type: 'corrosion', value: 2 }],
        description: '15의 방어도를 얻고, 적에게 부식(2)을 부여합니다.'
    },

    // === Tier 2 (10장) ===
    {
        id: 'BIO_016', name: '숙주 기생', pack: 'biohazard',
        type: 'attack', rarity: 'rare', tier: 2, cost: 1,
        keywords: [],
        effects: [
            { type: 'damage', value: 7 },
            { type: 'conditionalAdd', condition: 'virusTarget', conditionValue: 5, addDamage: 7 }
        ],
        description: '적에게 7의 피해를 줍니다. 적에게 바이러스가 5 이상이면 추가로 7의 피해를 줍니다.'
    },
    {
        id: 'BIO_017', name: '부식 침투탄', pack: 'biohazard',
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
        id: 'BIO_018', name: '산성 분사', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 2, cost: 1,
        keywords: ['corrosion'],
        effects: [
            { type: 'damage', value: 8 },
            { type: 'corrosion', value: 1 },
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 0 } // effect handler 밖에서 추가 부여 처리 까다로우므로
            // (간편화를 위해 조건부 로직을 효과 핸들러에 하나 더 둠)
        ],
        description: '적에게 8의 피해를 줍니다. 부식(1)을 부여합니다. 적에게 부식이 이미 있으면 부식(1)를 추가로 부여합니다.'
    },
    {
        id: 'BIO_019', name: '데이터 흡수', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: [],
        effects: [{ type: 'consumeVirusForUtility', consume: 5, energy: 2, shield: 10 }],
        description: '폭주(5): 적의 바이러스 스택을 5 소모합니다. 에너지를 2 얻고 10의 방어도를 얻습니다.'
    },
    {
        id: 'BIO_020', name: '면역 억제제', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['virus'],
        // '면역 억제제'의 경우 바이러스 2 부여 후 자신이 5인지 판정해야함 
        effects: [
            { type: 'virus', value: 2 },
            { type: 'consumeVirusForUtility', consume: 0, draw: 1 } // consume 0으로 핸들러 수정 필요 (추가 구현 대기)
        ],
        description: '바이러스(2)를 부여합니다. 이번 턴에 적에게 부여된 바이러스 수치가 5 이상이면 카드를 1장 뽑습니다.'
    },
    {
        id: 'BIO_021', name: '바이오 실드', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 1,
        keywords: ['corrosion'],
        effects: [
            // 절반 방어력 획득 이펙트는 전용 핸들러가 없으니 consumeVirusForShieldScale 사용 (consume 아님)
            // 구현 편의상 virus * 0.5 쉴드 전용 효과를 하나 만들어야함
            { type: 'consumeVirusForShieldScale', multiplier: 0.5, maxConsume: 0 }, // maxConsume 0이면 소모 안하도록 수정 필요
            { type: 'corrosion', value: 1 }
        ],
        description: '적에게 쌓인 바이러스 스택의 절반(내림)만큼 방어도를 얻습니다. 부식(1)을 부여합니다.'
    },
    {
        id: 'BIO_022', name: '세포 분열 촉진', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'virus', value: 5 },
            { type: 'consumeVirusForUtility', consume: 0, conditionTarget: 5, energy: 1 }
        ],
        description: '바이러스(5)를 부여합니다. 적에게 이미 바이러스가 5 이상 있다면 에너지를 1 얻습니다.'
    },
    {
        id: 'BIO_023', name: '감염원 추적', pack: 'biohazard',
        type: 'skill', rarity: 'rare', tier: 2, cost: 2, // 밸패 반영: 코스트 2
        keywords: ['virus'],
        effects: [{ type: 'draw', value: 2 }, { type: 'virus', value: 1 }],
        description: '카드를 2장 뽑습니다. 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_024', name: '만성 감염 프로토콜', pack: 'biohazard',
        type: 'power', rarity: 'rare', tier: 2, cost: 2,
        keywords: ['virus'],
        powerEffect: { type: 'autoVirus', value: 2 },
        description: '(설치) 매 턴 시작 시, 적에게 자동으로 바이러스(2)를 부여합니다.'
    },
    {
        id: 'BIO_025', name: '부식 필드', pack: 'biohazard',
        type: 'power', rarity: 'epic', tier: 2, cost: 2,
        keywords: ['corrosion'],
        powerEffect: { type: 'autoCorrosion', value: 1 },
        description: '(설치) 매 턴 시작 시, 적에게 부식(1)을 추가로 부여합니다.'
    },

    // === Tier 3 (10장) ===
    {
        id: 'BIO_026', name: '전이성 격발', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'consumeVirusForDamage', consume: 'all', multiplier: 2 }],
        description: '폭주(전부): 적의 바이러스 스택을 전부 소모합니다. 소모한 수치의 2배만큼 고정 피해를 줍니다.'
    },
    {
        id: 'BIO_027', name: '괴사 침식', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['corrosion'],
        // 방어 무력화는 복잡하므로 damage 관통 + 데미지 증폭 꼼수 혹은 쉴드 파괴 이펙트 구현 필요
        effects: [
            { type: 'damage', value: 20 },
            { type: 'corrosion', value: 3 },
            { type: 'conditionalAdd', condition: 'corrosionTarget', conditionValue: 5, destroyShield: true }
        ],
        description: '적에게 20의 피해를 줍니다. 부식(3)을 부여합니다. 적에게 부식이 5 이상이면 적의 방어도를 전부 제거합니다.'
    },
    {
        id: 'BIO_028', name: '용해성 맹독', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 3, cost: 2,
        keywords: ['corrosion'],
        effects: [{ type: 'meltToxin' }], // 밸패 반영 (방무딜 15 삭제)
        description: '폭주(8): 적의 바이러스 스택을 8 소모합니다. 적에게 약화(2) + 부식(3)을 부여합니다.'
    },
    {
        id: 'BIO_029', name: '생체 병기 투사', pack: 'biohazard',
        type: 'attack', rarity: 'epic', tier: 3, cost: 2,
        keywords: ['virus'],
        effects: [
            { type: 'damage', value: 5, hits: 4 },
            { type: 'virus', value: 4 } // 1스택 4회 통합 부여
        ],
        description: '적에게 5의 피해를 4번 줍니다. 각 히트마다 바이러스(1)를 부여합니다.'
    },
    {
        id: 'BIO_030', name: '대유행 선언', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 3, cost: 3,
        keywords: ['virus', 'corrosion'],
        effects: [
            { type: 'virus', value: 8 },
            { type: 'corrosion', value: 4 },
            { type: 'draw', value: 2 }
        ],
        description: '적에게 바이러스(8)와 부식(4)을 즉시 부여합니다. 카드를 2장 뽑습니다.'
    },
    {
        id: 'BIO_031', name: '항체 약탈', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 3, cost: 2,
        keywords: [],
        effects: [{ type: 'consumeVirusForUtility', consume: 6, heal: 15, strength: 2 }],
        description: '폭주(6): 적의 바이러스 스택을 6 소모합니다. 체력을 15 회복하고 힘(2)을 얻습니다.'
    },
    {
        id: 'BIO_032', name: '변종 적응체', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 3, cost: 1, // 밸패 반영: 소모 수치만큼 방어도
        keywords: [],
        effects: [{ type: 'consumeVirusForShieldScale', consumeAll: false, maxConsume: 15, multiplier: 1 }],
        description: '폭주(최대15): 적의 바이러스 스택을 최대 15까지 소모합니다. 소모한 스택 1당 1의 방어도를 얻습니다.'
    },

    // === Tier 4 (10장) ===
    {
        id: 'BIO_033', name: '보균자 역류', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['corrosion', 'virus'],
        effects: [
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 6 },
            { type: 'virus', value: 3 }
        ],
        description: '적에게 쌓인 부식 스택 1당 6의 고정 피해를 줍니다. 바이러스(3)를 부여합니다.'
    },
    {
        id: 'BIO_034', name: '전염병 연구소', pack: 'biohazard',
        type: 'power', rarity: 'rare', tier: 4, cost: 3,
        keywords: ['virus'],
        powerEffect: { type: 'viral_lab' }, // 바이러스 부여 효과시 가로채서 +1 하는 파워 
        description: '(설치) 내가 적에게 바이러스 스택을 부여할 때마다, 수치가 1 추가로 증가합니다.'
    },
    {
        id: 'BIO_035', name: '면역계 장악', pack: 'biohazard',
        type: 'power', rarity: 'epic', tier: 4, cost: 3,
        keywords: [],
        powerEffect: { type: 'immune_system_takeover' },
        description: '(설치) 내가 폭주할 때마다, 소모한 양의 절반(내림)만큼 방어도를 얻습니다.'
    },
    {
        id: 'BIO_036', name: '팬데믹 스톰', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3,
        keywords: ['corrosion'],
        effects: [{ type: 'consumeVirusForDamage', consume: 'all', multiplier: 2, applyCorrosionRatio: 0.5 }],
        description: '폭주(전부): 적의 바이러스 스택을 전부 소모합니다. 소모한 수치의 2배만큼 고정 피해를 주고 부식(소모량의 절반, 내림)을 부여합니다.'
    },
    {
        id: 'BIO_037', name: '네크로시스', pack: 'biohazard',
        type: 'attack', rarity: 'unique', tier: 4, cost: 3, // 밸패 반영: 기본 15피해
        keywords: ['corrosion'],
        effects: [
            { type: 'damage', value: 15 },
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 5 }
        ],
        description: '적에게 15의 피해를 줍니다. 적에게 부식이 있으면 부식 스택 × 5만큼 추가 피해를 줍니다.'
    },
    {
        id: 'BIO_038', name: '세포 용해 폭탄', pack: 'biohazard',
        type: 'attack', rarity: 'legendary', tier: 4, cost: 4,
        keywords: ['virus', 'corrosion'],
        effects: [
            { type: 'damage', value: 30 },
            { type: 'virus', value: 5 },
            { type: 'corrosion', value: 5 },
            // 적 힘 0으로 만드는 특수 처리 필요
            { type: 'conditionalAdd', condition: 'virusTarget', conditionValue: 10, setStrengthZero: true } // effects.js conditionalAdd 에 예외 처리 구현 필요
        ],
        description: '적에게 30의 피해를 줍니다. 바이러스(5) + 부식(5)를 부여합니다. 적에게 바이러스가 10 이상이면 적의 힘을 0으로 만듭니다.'
    },
    {
        id: 'BIO_039', name: '바이오 리퀴데이터', pack: 'biohazard',
        type: 'attack', rarity: 'legendary', tier: 4, cost: 2,
        keywords: ['accumulation', 'corrosion'],
        accumulationTarget: 5,
        accumulationStack: 0,
        effects: [{ type: 'damage', value: 10 }],
        accumulationEffects: [
            { type: 'damageByDebuff', debuff: 'virus', multiplier: 3 },
            { type: 'corrosion', value: 5 },
            { type: 'shield', value: 15 }
        ],
        description: '적에게 10의 피해를 줍니다. [내 카드가 누적 5코스트 이상 소모 시] 적의 바이러스 스택 × 3 피해 + 부식(5) + 15 방어도.'
    },
    {
        id: 'BIO_040', name: '오메가 변이', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 4, cost: 2,
        keywords: ['accumulation'],
        accumulationTarget: 6,
        accumulationStack: 0,
        effects: [],
        accumulationEffects: [
            { type: 'consumeVirusForUtility', consume: 0, draw: 3, energy: 3 } // 밸패 반영 
        ],
        description: '[내 카드가 누적 6코스트 이상 소모 시] 에너지를 3 얻고, 카드를 3장 뽑습니다.'
    },

    // === Tier 5 (5장) ===
    {
        id: 'BIO_041', name: '생체정화 장막', pack: 'biohazard',
        type: 'skill', rarity: 'unique', tier: 5, cost: 3,
        keywords: [],
        effects: [{ type: 'consumeVirusForUtility', consume: 10, heal: 20, shield: 30 }],
        description: '폭주(10): 적의 바이러스 스택을 10 소모합니다. 30의 방어도를 얻고 체력을 20 회복합니다.'
    },
    {
        id: 'BIO_042', name: '감염원 증폭기', pack: 'biohazard',
        type: 'skill', rarity: 'epic', tier: 5, cost: 2,
        keywords: ['accumulation', 'corrosion'],
        accumulationTarget: 8,
        accumulationStack: 0,
        effects: [],
        accumulationEffects: [
            { type: 'corrosion', value: 5 },
            { type: 'damageByDebuff', debuff: 'corrosion', multiplier: 5 } // 밸패 반영
        ],
        description: '[내 카드가 누적 8코스트 이상 소모 시] 부식(5)을 부여하고, 현재 적의 부식 스택 1당 5의 피해를 줍니다.'
    },
    {
        id: 'BIO_043', name: '바이러스 팜', pack: 'biohazard',
        type: 'power', rarity: 'legendary', tier: 5, cost: 3,
        keywords: [],
        powerEffect: { type: 'virus_farm' },
        description: '(설치) 턴 종료 시, 적에게 부여된 바이러스 스택의 20%(올림)만큼 추가 피해를 줍니다.'
    },
    {
        id: 'BIO_044', name: '생물학적 무기 금고', pack: 'biohazard',
        type: 'power', rarity: 'legendary', tier: 5, cost: 4, // 밸패 반영
        keywords: [],
        powerEffect: { type: 'bio_weapon_vault' },
        description: '(설치) 내가 폭주할 때마다, 소모한 양의 절반(내림)만큼 영구 힘을 얻습니다.'
    },
    {
        id: 'BIO_045', name: '절대 감염체', pack: 'biohazard',
        type: 'power', rarity: 'mythic', tier: 5, cost: 5,
        keywords: ['virus', 'corrosion'],
        effects: [{ type: 'damage', target: 'self', value: 15 }], // HP 페널티 구현
        powerEffect: { type: 'absolute_carrier', maxBonusStack: 5, value: 2 }, // param 자유
        description: '체력을 15 희생합니다. 매 턴 시작 시 바이러스(5), 부식(2)을 부여합니다. 내가 폭주할 때마다 에너지를 1 얻습니다.'
    }
]);
