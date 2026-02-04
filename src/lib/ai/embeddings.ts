// Web Worker Management for RAG
// Isolating Transformers.js in a worker prevents environment crashes in Next.js/Turbopack
import { gpuLock } from './gpu-lock';

let worker: Worker | null = null;
let terminateTimer: any = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

function terminateWorker() {
    if (worker) {
        console.log("[RAG] Auto-terminating worker to save resources...");
        worker.terminate();
        worker = null;
    }
}

function getWorker() {
    if (typeof window === 'undefined') return null;
    
    // Reset timer on access
    if (terminateTimer) clearTimeout(terminateTimer);
    terminateTimer = setTimeout(terminateWorker, 30000); // 30s idle timeout

    if (worker) return worker;

    try {
        console.log("[RAG] Initializing AI Web Worker...");
        // Next.js standard way to load workers
        worker = new Worker(new URL('./worker.ts', import.meta.url));

        worker.onmessage = (event) => {
            const { id, embedding, error } = event.data;
            const handler = pendingRequests.get(id);
            if (!handler) return;

            pendingRequests.delete(id);
            if (error) {
                handler.reject(new Error(error));
            } else {
                handler.resolve(embedding);
            }
        };

        worker.onerror = (err) => {
            console.error("[RAG] Worker Error:", err);
            // If worker crashes, clear it so next retry spawns new one
            worker = null;
        };

        return worker;
    } catch (e) {
        console.error("[RAG] Failed to initialize worker:", e);
        return null;
    }
}

/**
 * Generates an embedding for a string of text.
 * Now offloads to a Web Worker to ensure stability and UI responsiveness.
 * PROTECTED BY GPU LOCK to prevent LLM/RAG collisions.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // 1. Acquire Lock (Waits if Chat is active)
    await gpuLock.acquire('RAG');

    try {
        const aiWorker = getWorker();
        if (!aiWorker) {
            throw new Error("RAG Worker not available (SSR or Init Failure)");
        }

        const id = Math.random().toString(36).substring(7);
        
        return await new Promise((resolve, reject) => {
            pendingRequests.set(id, { resolve, reject });
            aiWorker.postMessage({ id, text });
            
            // Timeout just in case
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error("Embedding generation timed out"));
                }
            }, 30000);
        });
    } finally {
        // 2. Release Lock (Immediately allow Chat to resume)
        gpuLock.release();
    }
}

/**
 * Splits text into semantic chunks.
 * Standard Recursive Character splitting logic.
 */
export function chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
    if (!text) return [];
    
    // Split into paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
        if ((currentChunk.length + para.length) <= maxChunkSize) {
            currentChunk += (currentChunk ? "\n\n" : "") + para;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = para;
            
            // If a single paragraph is still too big, hard cut it
            if (currentChunk.length > maxChunkSize) {
                // ... (simplified cut for now)
                const sub = currentChunk.substring(0, maxChunkSize);
                chunks.push(sub);
                currentChunk = currentChunk.substring(maxChunkSize - overlap);
            }
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
}

/**
 * Calculates cosine similarity between two vectors.
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
    }
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
