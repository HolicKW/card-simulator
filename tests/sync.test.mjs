import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const tests = [
    ['sync check detects changed source data without rewriting the browser snapshot', async () => {
        const root = fileURLToPath(new URL('../', import.meta.url));
        const tempRoot = await mkdtemp(path.join(tmpdir(), 'newworld-sync-test-'));
        const resources = path.join(tempRoot, 'Assets', 'Resources');
        const browserPath = path.join(root, 'js', 'newworld-cards.js');
        const before = await readFile(browserPath, 'utf8');
        try {
            await mkdir(resources, { recursive: true });
            for (const filename of ['cards.json', 'specialCards.json']) {
                await writeFile(path.join(resources, filename), await readFile(path.join(root, 'js', 'data', filename)));
            }
            const args = [path.join(root, 'scripts', 'sync-newworld.mjs'), '--check', '--source', tempRoot];
            const matching = spawnSync(process.execPath, args, { encoding: 'utf8' });
            assert.equal(matching.status, 0, matching.stderr);
            const sourcePath = path.join(resources, 'cards.json');
            const data = JSON.parse(await readFile(sourcePath, 'utf8'));
            data.cards[0].cost++;
            await writeFile(sourcePath, JSON.stringify(data));
            const changed = spawnSync(process.execPath, args, { encoding: 'utf8' });
            assert.equal(changed.status, 1);
            assert.match(changed.stderr, /Out of date/);
            assert.equal(await readFile(browserPath, 'utf8'), before);
        } finally {
            const resolved = path.resolve(tempRoot);
            const prefix = path.resolve(tmpdir()) + path.sep;
            if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('newworld-sync-test-')) {
                throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
            }
            await rm(resolved, { recursive: true, force: true });
        }
    }]
];
