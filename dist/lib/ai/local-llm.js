var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { getModelConfig } from "./registry";
import { gpuLock } from "./gpu-lock";
export class WebLLMService {
    constructor() {
        this.engine = null;
        this.loading = false;
        this.currentModelId = null;
        this.initPromise = null;
        this.progressListeners = [];
        this.worker = null;
    }
    /**
     * Connect to or Initialize the Engine via Web Worker
     */
    async initialize(modelId, progressCallback, config = {}) {
        if (this.engine && this.currentModelId === modelId) {
            return;
        }
        // Check for Secure Context / Cache API (Required for WebLLM)
        if (typeof window !== 'undefined' && !window.caches) {
            throw new Error("Secure Context Required: The Cache API is missing. Please use HTTPS or 'localhost', or enable 'Insecure origins treated as secure' in chrome://flags.");
        }
        if (progressCallback) {
            this.progressListeners.push(progressCallback);
        }
        // If initialization is in progress, return the existing promise
        if (this.initPromise) {
            return this.initPromise;
        }
        this.loading = true;
        // Create a new initialization promise
        this.initPromise = (async () => {
            var _a, _b;
            try {
                console.log("[Meechi] Initializing via Dedicated Web Worker...");
                // Ensure previous engine is unloaded to free GPU memory
                if (this.engine) {
                    try {
                        console.log("[Meechi] Unloading previous engine...");
                        await this.engine.unload();
                        // Terminate old worker to fully free memory
                        if (this.worker) {
                            this.worker.terminate();
                            this.worker = null;
                        }
                    }
                    catch (e) {
                        console.warn("[Meechi] Failed to clean unload:", e);
                    }
                    this.engine = null;
                }
                // Get Model Config
                const modelConfig = getModelConfig(modelId);
                // PERFORMANCE TUNING: Mobile Detection
                // Mobile GPUs (iOS/Android) often crash with default 4096 context.
                // We aggressively cap it to 2048 or lower to ensure stability and speed.
                const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const defaultContext = (modelConfig === null || modelConfig === void 0 ? void 0 : modelConfig.context_window) || 4096;
                // If mobile, cap at 2048 (or the requested config, if lower).
                // If desktop, use the robust default.
                let safeContext = config.context_window || defaultContext;
                if (isMobile && safeContext > 2048) {
                    console.log("[Meechi] Mobile detected. Capping context window to 2048 for stability.");
                    safeContext = 2048;
                }
                // Create new Worker (Inline to avoid library distribution issues)
                const workerCode = `
                    import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";
                    const handler = new WebWorkerMLCEngineHandler();
                    self.onmessage = (msg) => { handler.onmessage(msg); };
                `;
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                this.worker = new Worker(workerUrl, { type: 'module' });
                this.engine = await CreateWebWorkerMLCEngine(this.worker, modelId, {
                    initProgressCallback: (progress) => {
                        this.progressListeners.forEach(cb => cb(progress.text));
                    },
                }, {
                    context_window_size: safeContext,
                });
                this.currentModelId = modelId;
            }
            catch (error) {
                console.error("Failed to initialize WebLLM:", error);
                // FORCE RESET on error
                if (this.engine) {
                    try {
                        await this.engine.unload();
                    }
                    catch (_c) { }
                    this.engine = null;
                }
                if (this.worker) {
                    this.worker.terminate();
                    this.worker = null;
                }
                this.currentModelId = null;
                // Check for GPU Context Lost
                if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("Context lost")) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("valid external Instance"))) {
                    console.warn("GPU Context Lost detected during init. Clearing state...");
                }
                throw error;
            }
            finally {
                this.loading = false;
                this.initPromise = null; // Clear promise so next attempt works
                this.progressListeners = []; // Clear listeners
            }
        })();
        return this.initPromise;
    }
    isInitialized() {
        return !!this.engine;
    }
    async chat(messages, onUpdate, options = {}) {
        var _a, e_1, _b, _c;
        var _d, _e, _f;
        if (!this.engine) {
            throw new Error("Local Engine not initialized");
        }
        // ACQUIRE GPU LOCK
        // This stops RAG from trying to embed while we are generating tokens
        await gpuLock.acquire('Chat');
        let fullResponse = "";
        try {
            const completion = await this.engine.chat.completions.create({
                messages: messages,
                stream: true,
                temperature: (_d = options.temperature) !== null && _d !== void 0 ? _d : 0.7,
                top_p: (_e = options.top_p) !== null && _e !== void 0 ? _e : 0.9,
                stop: options.stop,
                frequency_penalty: 0.1, // Slight penalty to prevent infinite loops "The user has asked..."
            });
            try {
                for (var _g = true, completion_1 = __asyncValues(completion), completion_1_1; completion_1_1 = await completion_1.next(), _a = completion_1_1.done, !_a; _g = true) {
                    _c = completion_1_1.value;
                    _g = false;
                    const chunk = _c;
                    const delta = ((_f = chunk.choices[0]) === null || _f === void 0 ? void 0 : _f.delta.content) || "";
                    if (delta) {
                        fullResponse += delta;
                        onUpdate(delta);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_g && !_a && (_b = completion_1.return)) await _b.call(completion_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (e) {
            console.error("WebLLM Chat Error:", e);
            // Detect GPU Context Loss or Device Loss
            const errMsg = e.message || "";
            if (errMsg.includes("Context lost") || errMsg.includes("Device was lost") || errMsg.includes("Instance reference no longer exists") || errMsg.includes("dropped in popErrorScope") || errMsg.includes("already been disposed")) {
                console.warn("GPU Crash detected. Resetting WebLLM engine state...");
                this.engine = null;
                this.currentModelId = null;
                if (this.worker) {
                    this.worker.terminate();
                    this.worker = null;
                }
                // Propagate a specific error for the UI to handle (e.g., suggest reload)
                throw new Error("GPU_CRASH");
            }
            throw e;
        }
        finally {
            // RELEASE GPU LOCK
            gpuLock.release();
        }
        return fullResponse;
    }
    isLoading() {
        return this.loading;
    }
    getModelId() {
        return this.currentModelId;
    }
    async interrupt() {
        if (this.engine) {
            await this.engine.interruptGenerate();
        }
    }
    /**
     * Completely unload the engine and terminate the worker to free memory.
     */
    async unload() {
        if (this.engine) {
            try {
                console.log("[Meechi] Unloading engine explicitly...");
                await this.engine.unload();
            }
            catch (e) {
                console.warn("[Meechi] Error unloading engine:", e);
            }
            this.engine = null;
        }
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.currentModelId = null;
    }
}
export const localLlmService = new WebLLMService();
