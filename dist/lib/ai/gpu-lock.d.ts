/**
 * A simple Mutex to ensure only one heavy GPU task runs at a time.
 * Prevents "Context Lost" errors when WebLLM and TensorFlow.js try to
 * allocate VRAM simultaneously.
 */
export declare class GPUResourceLock {
    private locked;
    private queue;
    /**
     * Request access to the GPU. Returns a promise that resolves when access is granted.
     * @param debugName - Name of the requester for logging
     */
    acquire(debugName: string): Promise<void>;
    /**
     * Release the GPU lock, allowing the next task in queue to proceed.
     */
    release(): void;
}
export declare const gpuLock: GPUResourceLock;
