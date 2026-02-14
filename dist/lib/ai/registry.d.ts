export interface ModelConfig {
    id: string;
    name: string;
    family: 'llama' | 'gemma' | 'phi' | 'generic';
    vram_required_mb: number;
    low_power: boolean;
    context_window: number;
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
export declare const AVAILABLE_MODELS: {
    local: LocalModelConfig[];
    groq: CloudModelConfig[];
    gemini: CloudModelConfig[];
};
export declare function getModelConfig(modelId: string): LocalModelConfig | undefined;
export declare function getSystemPromptForModel(modelId: string): string;
export {};
