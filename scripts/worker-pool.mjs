// Node(worker_threads)에서 병렬 성능 측정기를 만든다. CLI와 테스트가 같이 쓴다.
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import { PerformanceEvaluator, workerCount } from '../js/performance.js';

const WORKER_URL = new URL('../js/performance-worker.js', import.meta.url);

export function nodeWorkerEvaluator(count = workerCount(os.availableParallelism?.() ?? os.cpus().length)) {
    return new PerformanceEvaluator({ workers: count, createWorker: () => {
        const worker = new Worker(WORKER_URL);
        return {
            post: message => worker.postMessage(message),
            listen: handler => {
                worker.on('message', handler);
                worker.on('error', error => handler({ type: 'error', message: error.message }));
            },
            terminate: () => worker.terminate()
        };
    } });
}
