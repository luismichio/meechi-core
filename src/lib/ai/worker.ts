// Web Worker for Semantic Embeddings (RAG)
// Switched from TensorFlow.js to Transformers.js (Static Asset Strategy)
// This ensures offline capability and 0 build errors.
export {};

declare const self: Worker & { onmessage: any; postMessage: any };

// Global storage for the pipeline
let embedder: any = null;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Helper to load the library from static vendor file
async function loadLibrary() {
    // @ts-ignore
    if (self.transformers) return self.transformers;
    
    console.log("[RAG Worker] Loading Transformers.js from static vendor...");
    // Import from public/vendor/transformers.js (served by the main app)
    // @ts-ignore
    const mod = await import(/* webpackIgnore: true */ '/vendor/transformers.js');
    return mod;
}

// Initialize the model
async function init() {
    if (embedder) return embedder;

    try {
        const { pipeline, env } = await loadLibrary();
        
        // Configure environment
        env.allowLocalModels = false; // Fetch model weights from CDN (or cache)
        env.useBrowserCache = true;   // Cache weights in browser (Offline support after first load)
        
        console.log(`[RAG Worker] Loading Model: ${EMBEDDING_MODEL}...`);
        
        // Load the feature extraction pipeline
        embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, {
            quantized: true, // Use quantized model for speed/size (matches USE performance)
        });
        
        console.log("[RAG Worker] Model loaded successfully!");
        return embedder;
    } catch (err) {
        console.error("[RAG Worker] Initialization Failed:", err);
        throw err;
    }
}

self.onmessage = async (event: any) => {
    const { id, text } = event.data;
    
    if (!text) {
        self.postMessage({ id, error: "No text provided" });
        return;
    }

    try {
        const pipe = await init();
        
        // Convert text to embedding
        // output is a Tensor { data: Float32Array, dims: [...] }
        const output = await pipe(text, {
            pooling: 'mean', // Mean pooling is standard for sentence embeddings
            normalize: true,  // Normalize vectors for cosine similarity
        });

        // Extract the vector as a plain array
        const embedding = Array.from(output.data);

        self.postMessage({ id, embedding });
    } catch (err: any) {
        console.error("[RAG Worker] Error:", err);
        self.postMessage({ id, error: err.message });
    }
};
