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
