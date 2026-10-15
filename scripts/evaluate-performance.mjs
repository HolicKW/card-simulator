import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PerformanceEvaluator, PILOT_CARDS } from '../js/performance.js';
import { getAllCards } from '../js/cards.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
    const index = args.indexOf(flag);
    if (index < 0) return fallback;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} requires a value`);
    return args[index + 1];
};
for (const arg of args.filter(arg => arg.startsWith('--'))) {
    if (!['--all', '--seeds', '--seed', '--probes', '--output'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
}
const output = path.resolve(value('--output', 'performance-results.json'));
const evaluator = new PerformanceEvaluator();
let previous = '';
const report = await evaluator.run({ cardIds: args.includes('--all') ? getAllCards().map(card => card.id) : PILOT_CARDS,
    seeds: Number(value('--seeds', '50')), seed: Number(value('--seed', '1')), probeSamples: Number(value('--probes', '50'))
}, progress => {
    const key = `${progress.cardId}:${progress.context}`;
    if (previous !== key) {
        console.log(`${Math.floor(progress.current / progress.total * 100)}% ${key}`);
        previous = key;
    }
});
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ kind: 'performance-report', schemaVersion: 1, performance: report }, null, 2) + '\n');
console.log(JSON.stringify({ output, cards: Object.keys(report.cards).length,
    matches: Object.values(report.cards).reduce((sum, result) => sum + result.general.matches + result.dedicated.matches, 0),
    calibrated: Object.values(report.cards).filter(result => result.general.calibrated).length,
    tierTargets: report.tierTargets }));
