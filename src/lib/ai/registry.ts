import { SYSTEM_PROMPT } from './prompts';

export interface ModelConfig {
    id: string; // The WebLLM Model ID
    name: string; // Display Name
    family: 'llama' | 'gemma' | 'phi' | 'generic'; // For prompt formatting
    vram_required_mb: number; // estimated
    low_power: boolean; // Is this suitable for low power devices?
    context_window: number; // Max context
}

// WebLLM / Local Configs
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

export const AVAILABLE_MODELS = {
    local: [
        {
            id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
            name: 'Llama 3.2 1B (Fastest)',
            family: 'llama',
            vram_required_mb: 1500,
            low_power: true,
            context_window: 4096
        },
        {
            id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
            name: 'Llama 3.2 3B (Balanced)',
            family: 'llama',
            vram_required_mb: 3000,
            low_power: false,
            context_window: 8192
        },
        {
            id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
            name: 'TinyLlama 1.1B',
            family: 'llama', 
            vram_required_mb: 1000,
            low_power: true,
            context_window: 2048
        }
    ] as LocalModelConfig[],
    
    groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)', context_window: 32768 },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)', context_window: 32768 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', context_window: 32768 },
        { id: 'gemma-2-9b-it', name: 'Gemma 2 9B', context_window: 8192 }
    ] as CloudModelConfig[],

    gemini: [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)', context_window: 1000000 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Powerful)', context_window: 2000000 },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', context_window: 32000 }
    ] as CloudModelConfig[]
};

export function getModelConfig(modelId: string): LocalModelConfig | undefined {
    return AVAILABLE_MODELS.local.find(m => m.id === modelId);
}

// Factory for getting the right System Prompt based on Model Family
export function getSystemPromptForModel(modelId: string): string {
    const config = getModelConfig(modelId);
    if (!config) return SYSTEM_PROMPT; // Default

    // We can specialize prompts here if needed in the future
    // For now, Llama family works well with the default XML prompt
    return SYSTEM_PROMPT;
}
