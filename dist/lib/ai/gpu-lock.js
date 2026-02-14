/**
 * A simple Mutex to ensure only one heavy GPU task runs at a time.
 * Prevents "Context Lost" errors when WebLLM and TensorFlow.js try to
 * allocate VRAM simultaneously.
 */
export class GPUResourceLock {
    constructor() {
        this.locked = false;
        this.queue = [];
    }
    /**
     * Request access to the GPU. Returns a promise that resolves when access is granted.
     * @param debugName - Name of the requester for logging
     */
    async acquire(debugName) {
        if (!this.locked) {
            this.locked = true;
            // console.log(`[GPU Lock] Acquired by ${debugName}`);
            return Promise.resolve();
        }
        // console.log(`[GPU Lock] ${debugName} waiting for lock...`);
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.locked = true;
                // console.log(`[GPU Lock] Acquired by ${debugName} (after wait)`);
                resolve();
            });
        });
    }
    /**
     * Release the GPU lock, allowing the next task in queue to proceed.
     */
    release() {
        this.locked = false;
        // console.log(`[GPU Lock] Released`);
        const next = this.queue.shift();
        if (next) {
            next();
        }
    }
}
// Global Singleton
export const gpuLock = new GPUResourceLock();
