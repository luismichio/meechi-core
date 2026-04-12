import { SYSTEM_PROMPT } from './prompts';
const modelPromptOverrides = {};
export function registerModelPromptOverrides(overrides) {
    Object.assign(modelPromptOverrides, overrides);
}
export const AVAILABLE_MODELS = {
    local: [
        // Ordered small -> large
        {
            id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
            name: 'Qwen 2.5 0.5B',
            family: 'qwen',
            vram_required_mb: 800,
            low_power: true,
            context_window: 32768,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 800
        },
        {
            id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
            name: 'TinyLlama 1.1B',
            family: 'llama',
            vram_required_mb: 1000,
            low_power: true,
            context_window: 2048,
            license: 'llama-3.2-community',
            termsUrl: 'https://llama.meta.com/llama3/license/',
            preConsentRequired: true,
            estimatedDownloadMB: 1000
        },
        {
            id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
            name: 'Qwen 2.5 1.5B',
            family: 'qwen',
            vram_required_mb: 1600,
            low_power: true,
            context_window: 32768,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 1600
        },
        {
            id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
            name: 'Llama 3.2 1B',
            family: 'llama',
            vram_required_mb: 1800,
            low_power: false,
            context_window: 4096,
            license: 'llama-3.2-community',
            termsUrl: 'https://llama.meta.com/llama3/license/',
            preConsentRequired: true,
            estimatedDownloadMB: 1800
        },
        {
            id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
            name: 'Phi-3 Mini',
            family: 'phi',
            vram_required_mb: 1800,
            low_power: true,
            context_window: 4096,
            license: 'mit',
            termsUrl: 'https://opensource.org/licenses/MIT',
            preConsentRequired: false,
            estimatedDownloadMB: 1800
        },
        {
            id: 'gemma-2b-it-q4f16_1-MLC',
            name: 'Gemma 2B',
            family: 'gemma',
            vram_required_mb: 2000,
            low_power: true,
            context_window: 8192,
            license: 'gemma-terms',
            termsUrl: 'https://ai.google.dev/gemma/terms',
            preConsentRequired: true,
            estimatedDownloadMB: 2000
        },
        {
            id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
            name: 'Qwen 2.5 3B',
            family: 'qwen',
            vram_required_mb: 3000,
            low_power: false,
            context_window: 32768,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 3000
        },
        {
            id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
            name: 'Llama 3.2 3B',
            family: 'llama',
            vram_required_mb: 3200,
            low_power: false,
            context_window: 8192,
            license: 'llama-3.2-community',
            termsUrl: 'https://llama.meta.com/llama3/license/',
            preConsentRequired: true,
            estimatedDownloadMB: 3200
        },
        {
            id: 'Qwen3-4B-q4f16_1-MLC',
            name: 'Qwen3 4B',
            family: 'qwen',
            vram_required_mb: 4000,
            low_power: false,
            context_window: 32768,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 4000
        },
        {
            id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
            name: 'Mistral 7B Instruct',
            family: 'mistral',
            vram_required_mb: 4500,
            low_power: false,
            context_window: 8192,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 4500
        },
        {
            id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
            name: 'Qwen 2.5 7B',
            family: 'qwen',
            vram_required_mb: 4500,
            low_power: false,
            context_window: 32768,
            license: 'apache-2.0',
            termsUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            preConsentRequired: false,
            estimatedDownloadMB: 4500
        },
        {
            id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
            name: 'Llama 3.1 8B',
            family: 'llama',
            vram_required_mb: 5000,
            low_power: false,
            context_window: 8192,
            license: 'llama-3.2-community',
            termsUrl: 'https://llama.meta.com/llama3/license/',
            preConsentRequired: true,
            estimatedDownloadMB: 5000
        },
        {
            id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
            name: 'DeepSeek R1 7B',
            family: 'qwen',
            vram_required_mb: 5100,
            low_power: false,
            context_window: 4096,
            license: 'mit',
            termsUrl: 'https://opensource.org/licenses/MIT',
            preConsentRequired: false,
            estimatedDownloadMB: 5100
        }
    ],
    groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile)', context_window: 32768 },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant)', context_window: 32768 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', context_window: 32768 },
        { id: 'gemma-2-9b-it', name: 'Gemma 2 9B', context_window: 8192 }
    ],
    openai: [
        // Common stable models (kept conservative)
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context_window: 32768 },
        { id: 'gpt-4o', name: 'GPT-4o', context_window: 131072 },
        { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime (Preview)', context_window: 32768 },
        { id: 'gpt-4', name: 'GPT-4', context_window: 8192 },
        { id: 'gpt-4-32k', name: 'GPT-4 (32k)', context_window: 32768 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context_window: 4096 }
    ],
    gemini: [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)', context_window: 1000000 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Powerful)', context_window: 2000000 },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', context_window: 32000 }
    ]
};
export function getModelConfig(modelId) {
    return AVAILABLE_MODELS.local.find(m => m.id === modelId);
}
export function getSystemPromptForModel(modelId) {
    const modelOverride = modelPromptOverrides[modelId];
    if (modelOverride) {
        return modelOverride;
    }
    const config = getModelConfig(modelId);
    if (!config)
        return SYSTEM_PROMPT; // Default
    switch (config.family) {
        case 'phi':
            return 'You are a helpful AI assistant.';
        default:
            return SYSTEM_PROMPT;
    }
}
/**
 * Returns the context window for any model ID, searching across all provider lists.
 * Falls back to a conservative 4096 if the model is not found.
 */
export function getModelContextWindow(modelId) {
    var _a, _b;
    const allModels = [
        ...AVAILABLE_MODELS.local,
        ...AVAILABLE_MODELS.groq,
        ...AVAILABLE_MODELS.openai,
        ...AVAILABLE_MODELS.gemini,
    ];
    return (_b = (_a = allModels.find(m => m.id === modelId)) === null || _a === void 0 ? void 0 : _a.context_window) !== null && _b !== void 0 ? _b : 4096;
}
/**
 * Computes the maximum number of history messages to include in a prompt,
 * based on the model's context window. Larger windows = more context.
 *
 * Reserves ~2048 tokens for system prompt + current user message + model output.
 * Assumes ~256 tokens per average message as a conservative estimate.
 */
export function getMaxHistoryMessages(modelId) {
    const contextWindow = getModelContextWindow(modelId);
    const RESERVED_TOKENS = 2048;
    const AVG_TOKENS_PER_MSG = 256;
    const available = contextWindow - RESERVED_TOKENS;
    const computed = Math.floor(available / AVG_TOKENS_PER_MSG);
    // Clamp: min 4 messages, max 40 messages (practical ceiling for coherence)
    return Math.min(40, Math.max(4, computed));
}
