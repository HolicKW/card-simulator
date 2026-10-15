// Mathf.RoundToInt uses the nearest even integer at .5, including negative values.
export function roundToInt(value) {
    const lower = Math.floor(value);
    const fraction = value - lower;
    if (fraction < 0.5) return lower;
    if (fraction > 0.5) return lower + 1;
    return lower % 2 === 0 ? lower : lower + 1;
}

export function hasKeyword(card, keyword) {
    return Array.isArray(card?.keywords) && card.keywords.includes(keyword);
}

// Rebuild returns the same card; explicit copies retain the current runtime values.
export function cloneCard(card) {
    return card == null ? card : JSON.parse(JSON.stringify(card));
}
