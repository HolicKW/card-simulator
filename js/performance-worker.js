/**
 * performance-worker.js — 카드 성능 측정 워커
 *
 * 메인 스레드(PerformanceEvaluator._runParallel)가 { id, config }를 보내면 카드 한 장을 측정해
 * 진행 상황('progress')과 결과('done')를 돌려준다. 브라우저 Web Worker와 Node worker_threads 공용.
 */

import { evaluateCard } from './performance.js';
import { applyCardOverrides, overridesKey } from './cards.js';

const PROGRESS_EVERY = 5;   // 진행 상황을 보내는 간격(판 수)

const port = typeof WorkerGlobalScope !== 'undefined'
    ? { send: message => self.postMessage(message), listen: handler => { self.onmessage = event => handler(event.data); } }
    : await import('node:worker_threads').then(({ parentPort }) =>
        ({ send: message => parentPort.postMessage(message), listen: handler => parentPort.on('message', handler) }));

let appliedKey = overridesKey({});
port.listen(async ({ id, config }) => {
    try {
        // 워커는 카드 데이터를 따로 불러오므로 메인 스레드와 같은 수치 수정을 적용한다
        const key = overridesKey(config.overrides ?? {});
        if (key !== appliedKey) {
            applyCardOverrides(config.overrides ?? {});
            appliedKey = key;
        }
        let reported = 0;
        const result = await evaluateCard(id, config, {
            onTrials: (context, seeds) => {
                const done = seeds === config.seeds;
                if (seeds % PROGRESS_EVERY && !done) return;
                const sent = (config.contexts.indexOf(context) * config.seeds) + seeds;
                port.send({ type: 'progress', id, context, seeds, trials: sent - reported });
                reported = sent;
            }
        });
        port.send({ type: 'done', id, result });
    } catch (error) {
        port.send({ type: 'error', id, message: error.message });
    }
});
