export interface ModelConfig {
    id: string;
    name: string;
    family: 'llama' | 'gemma' | 'phi' | 'generic';
    vram_required_mb: number;
    low_power: boolean;
    context_window: number;
    license?: string;
    termsUrl?: string;
    preConsentRequired?: boolean;
    estimatedDownloadMB?: number;
}
interface LocalModelConfig extends ModelConfig {
    id: string;
    name: string;
    family: 'llama' | 'gemma' | 'phi' | 'generic';
    vram_required_mb: number;
    low_power: boolean;
    context_window: number;
}
interface CloudModelConfig {
    id: string;
    name: string;
    context_window: number;
}
export declare function registerModelPromptOverrides(overrides: Record<string, string>): void;
export declare const AVAILABLE_MODELS: {
    local: LocalModelConfig[];
    groq: CloudModelConfig[];
    openai: CloudModelConfig[];
    gemini: CloudModelConfig[];
};
export declare function getModelConfig(modelId: string): LocalModelConfig | undefined;
export declare function getSystemPromptForModel(modelId: string): string;
/**
 * Returns the context window for any model ID, searching across all provider lists.
 * Falls back to a conservative 4096 if the model is not found.
 */
export declare function getModelContextWindow(modelId: string): number;
/**
 * Computes the maximum number of history messages to include in a prompt,
 * based on the model's context window. Larger windows = more context.
 *
 * Reserves ~2048 tokens for system prompt + current user message + model output.
 * Assumes ~256 tokens per average message as a conservative estimate.
 */
export declare function getMaxHistoryMessages(modelId: string): number;
export {};
