import { readdir } from 'node:fs/promises';

let passed = 0;
let failed = 0;
for (const filename of (await readdir(new URL('.', import.meta.url))).filter(name => name.endsWith('.test.mjs')).sort()) {
    const { tests } = await import(new URL(filename, import.meta.url));
    for (const [name, test] of tests) {
        try {
            await test();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            failed++;
            console.error(`FAIL ${name}\n${error.stack}`);
        }
    }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
