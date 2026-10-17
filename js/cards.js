/** NewWorld data with presentation-only aliases for the existing dashboard. */
import { newWorldCards, newWorldSpecialCards } from './newworld-cards.js';

const PACKS = new Map();
const ALL_CARDS = [];
const SPECIAL_CARDS = [];
const TYPES = { Attack: 'attack', Skill: 'skill', Core: 'power' };

export function formatCardDescription(card) {
    return (card.rawDescription ?? card.description ?? '')
        .replace(/\{(\d+)\}/g, (match, index) => {
            const value = card.effects?.[Number(index)]?.value;
            return value == null ? match : String(value);
        })
        .replace(/\{d(?:hp)?:(\d+)\}/g, '$1');
}

function normalizeCard(card) {
    return {
        ...card,
        name: card.cardName || card.name,
        type: TYPES[card.type] || card.type,
        rarity: card.rarity.toLowerCase(),
        rawDescription: card.rawDescription ?? card.description ?? '',
        description: formatCardDescription(card),
        keywords: card.keywords || [],
        effects: card.effects || [],
        rebuildCount: card.rebuildCount || 0,
        accumulationCount: card.accumulationCount || 0,
        isTemporary: card.isTemporary || false,
        ransomwareDamage: card.ransomwareDamage || 0
    };
}

export function registerPack(packId, packInfo) {
    PACKS.set(packId, packInfo);
}

export function getPack(packId) {
    return PACKS.get(packId);
}

export function getAllPacks() {
    return Array.from(PACKS.entries()).map(([id, info]) => ({ id, ...info }));
}

export function registerCards(cards) {
    ALL_CARDS.push(...cards.map(normalizeCard));
}

export function getCardById(id) {
    return ALL_CARDS.find(card => card.id === id) || getSpecialCardById(id);
}

export function getSpecialCardById(id) {
    return SPECIAL_CARDS.find(card => card.id === id);
}

export function getCardsByPack(packId) {
    return ALL_CARDS.filter(card => card.pack === packId);
}

export function getCardsByTier(tier) {
    return ALL_CARDS.filter(card => card.tier === tier);
}

export function getCardsByRarity(rarity) {
    return ALL_CARDS.filter(card => card.rarity === rarity);
}

export function getAllCards() {
    return [...ALL_CARDS];
}

registerCards(newWorldCards);
SPECIAL_CARDS.push(...newWorldSpecialCards.map(normalizeCard));

const packInfo = {
    base: { name: '기본 공용 카드', description: '공통 베이스 카드군' },
    overclock: { name: '오버클럭 코어 팩', description: '오버클럭 스택과 과부하' },
    dismantle: { name: '해체/재구축 팩', description: '해체, 추출, 재구축' },
    network: { name: '네트워크 프로토콜 팩', description: '네트워크 스택과 프로토콜' },
    biohazard: { name: '바이오 해저드 팩', description: '바이러스와 부식' },
    russian_roulette: { name: '러시안 룰렛팩', description: '행운과 도박' },
    IP: { name: 'IP 팩', description: 'NewWorld IP 카드' }
};
for (const pack of new Set(ALL_CARDS.map(card => card.pack))) {
    registerPack(pack, {
        ...(packInfo[pack] || { name: pack, description: '' }),
        totalCards: getCardsByPack(pack).length
    });
}

// ─── 시뮬레이터 안에서만 쓰는 카드 수치 수정 ───
// 원본은 따로 두고, 검증한 수정만 수정본 카드로 바꿔 끼운다. 전투·AI·측정은 모두 ALL_CARDS에서 카드를 꺼내므로 바로 반영된다.
const ORIGINALS = new Map(ALL_CARDS.map(card => [card.id, JSON.parse(JSON.stringify(card))]));
const EDITABLE_ROOTS = ['effects', 'coreEffect', 'accumulationTarget', 'accumulationEffects'];
const MAX_COST = 20;
const MAX_VALUE = 9999;
const EFFECT_LABELS = {
    damage: '피해', draw: '드로우', scaledDamage: '비례 피해', conditional: '조건', shield: '실드', energy: '에너지',
    dismantle: '해체', virus: '바이러스', gamble: '도박', scaledShield: '비례 실드', weakness: '약화', overflow: '오버플로',
    modifyStat: '능력치 변경', corrosion: '부식', heal: '회복', selfDamage: '자해', searchByType: '유형 탐색',
    scaledSelfDamage: '비례 자해', damageByDebuff: '디버프 비례 피해', overclockReduce: '오버클럭 감소',
    selfDamagePercent: '비율 자해', strength: '힘', overclockGain: '오버클럭 획득', addLuck: '행운', tempStrength: '임시 힘',
    healPercent: '비율 회복', addExtraDraw: '추가 드로우', energyNextTurn: '다음 턴 에너지', shieldBreak: '실드 파괴',
    hpBelow: '체력 % 미만', virusMin: '적 바이러스 이상', dismantledThisTurn: '이번 턴 해체 수',
    cardsPlayedThisTurn: '이번 턴 사용 카드 수', networkCardsPlayed: '네트워크 카드 사용 수'
};
const FIELD_LABELS = {
    hits: '횟수', multiplier: '배수', chance: '확률', ratio: '비율', bonusMultiplier: '추가 배수', threshold: '기준',
    fraction: '비율', max: '최대', min: '최소', minValue: '최소', drawBeforeSelect: '먼저 볼 장수', recallCount: '회수 장수',
    shield: '실드', energy: '에너지', draw: '드로우', heal: '회복', damage: '피해', energyCost: '에너지 비용',
    costReduction: '코스트 감소', maxEnergy: '최대 에너지', maxBonusStack: '최대 중첩'
};
let cardOverrides = {};

const readPath = (value, path) => path.reduce((node, key) => node?.[key], value);
const numericPaths = (value, path) => typeof value === 'number' ? [path]
    : value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => numericPaths(child, [...path, key])) : [];

function fieldLabel(card, path) {
    if (path[0] === 'cost') return '코스트';
    if (path[0] === 'rebuildCount') return '재구축 횟수';
    if (path[0] === 'accumulationTarget') return '누적 목표';
    const parts = [];
    let node = card;
    for (let index = 0; index < path.length; index++) {
        const key = path[index];
        node = node?.[key];
        if (index === path.length - 1) {
            if (key !== 'value' || !parts.length) parts.push(FIELD_LABELS[key] || key);
        } else if (key === 'effects' || key === 'accumulationEffects') {
            const item = card[key]?.[path[index + 1]];
            parts.push(`${key === 'effects' ? '효과' : '누적 효과'} ${Number(path[index + 1]) + 1} ${EFFECT_LABELS[item?.type] || item?.type || ''}`.trim());
            node = item;
            index++;
        } else if (key === 'thenEffects' || key === 'elseEffects') {
            const item = node?.[path[index + 1]];
            parts.push(`${key === 'thenEffects' ? '충족 시' : '아니면'} ${EFFECT_LABELS[item?.type] || item?.type || ''}`.trim());
            node = item;
            index++;
        } else if (key === 'condition') parts.push(`조건(${EFFECT_LABELS[node?.type] || node?.type || ''})`);
        else if (key === 'scaling') parts.push('비례');
        else if (key === 'coreEffect') parts.push('코어 효과');
        else if (!/^\d+$/.test(key)) parts.push(key);
    }
    return parts.join(' · ');
}

// 수정할 수 있는 숫자 항목: 코스트, 재구축 횟수, 효과·코어·누적 효과 안의 모든 숫자
export function listEditableFields(id) {
    const original = ORIGINALS.get(id);
    if (!original) return [];
    const current = getCardById(id);
    const paths = [['cost'], ...(original.rebuildCount > 0 ? [['rebuildCount']] : []),
        ...EDITABLE_ROOTS.flatMap(root => numericPaths(original[root], [root]))];
    return paths.map(path => ({ path: path.join('.'), label: fieldLabel(original, path),
        original: readPath(original, path), value: readPath(current, path) }));
}

// 형식·범위를 확인하고 원본과 같은 값은 뺀 정리본을 돌려준다. 하나라도 틀리면 전체를 거부한다.
export function validateCardOverrides(overrides) {
    const fail = reason => { throw new Error(`카드 수정 값이 올바르지 않습니다: ${reason}`); };
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) fail('형식');
    const clean = {};
    for (const [id, edits] of Object.entries(overrides)) {
        if (!ORIGINALS.has(id)) fail(`없는 카드 ${id}`);
        if (!edits || typeof edits !== 'object' || Array.isArray(edits)) fail(`${id} 형식`);
        const allowed = new Map(listEditableFields(id).map(field => [field.path, field.original]));
        for (const [path, value] of Object.entries(edits)) {
            if (!allowed.has(path)) fail(`${id}의 ${path}`);
            if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_VALUE) fail(`${id}의 ${path} 값`);
            if (path === 'cost' && (!Number.isInteger(value) || value < 0 || value > MAX_COST)) fail(`${id}의 코스트`);
            if (value !== allowed.get(path)) (clean[id] ||= {})[path] = value;
        }
    }
    return clean;
}

export function applyCardOverrides(overrides = {}) {
    const clean = validateCardOverrides(overrides);
    for (let index = 0; index < ALL_CARDS.length; index++) {
        const id = ALL_CARDS[index].id;
        if (!clean[id] && !cardOverrides[id]) continue;
        const card = JSON.parse(JSON.stringify(ORIGINALS.get(id)));
        for (const [path, value] of Object.entries(clean[id] || {})) {
            const keys = path.split('.');
            readPath(card, keys.slice(0, -1))[keys.at(-1)] = value;
        }
        card.description = formatCardDescription(card);
        ALL_CARDS[index] = card;
    }
    cardOverrides = clean;
    return getCardOverrides();
}

export const getCardOverrides = () => JSON.parse(JSON.stringify(cardOverrides));

// 수정 상태 비교용 키 (항목 순서와 무관)
export const overridesKey = (overrides = {}) => JSON.stringify(Object.keys(overrides).sort()
    .map(id => [id, Object.keys(overrides[id]).sort().map(path => [path, overrides[id][path]])]));
