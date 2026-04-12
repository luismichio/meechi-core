/**
 * Generates an embedding for a string of text.
 * Now offloads to a Web Worker to ensure stability and UI responsiveness.
 * PROTECTED BY GPU LOCK to prevent LLM/RAG collisions.
 */
export declare function generateEmbedding(text: string): Promise<number[]>;
/**
 * Splits text into semantic chunks.
 * Standard Recursive Character splitting logic.
 */
export declare function chunkText(text: string, maxChunkSize?: number, overlap?: number): string[];
/**
 * Calculates cosine similarity between two vectors.
 */
export declare function cosineSimilarity(v1: number[], v2: number[]): number;
