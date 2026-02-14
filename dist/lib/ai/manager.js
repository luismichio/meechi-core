import { SYSTEM_PROMPT } from "./prompts";
import { GroqProvider } from "./providers/groq";
import { GeminiProvider } from "./providers/gemini";
export class AIManager {
    constructor() {
        this.providers = new Map();
        // Register default providers
        this.registerProvider(new GroqProvider());
        this.registerProvider(new GeminiProvider());
    }
    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }
    async chat(userMessage, systemContext, history, config, tools) {
        // 1. Determine Primary Provider
        const primaryId = config.activeProviderId || 'groq';
        const providerConfig = config.providers.find(p => p.id === primaryId);
        let provider = this.providers.get(primaryId);
        // CHECK API KEY for Cloud Providers
        if (primaryId === 'openai' && !(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.apiKey) && !process.env.OPENAI_API_KEY) {
            console.warn("[Cloud] No OpenAI Key found.");
            return {
                content: "I am unable to connect to the cloud because no API Key is configured. Please check your settings or restart the Local AI.",
                usage: { total_tokens: 0 }
            };
        }
        if (!provider) {
            console.warn(`Provider ${primaryId} not found. Falling back to Groq.`);
            provider = this.providers.get('groq');
        }
        // 2. Construct Messages
        // Inject Identity/Tone into System Prompt
        // Inject Identity/Tone into System Prompt
        // 2. Construct Messages
        const systemPrompt = `
${SYSTEM_PROMPT}

Context:
${systemContext}
        `.trim();
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage }
        ];
        // 3. Attempt Chat
        // We throw errors to let the client handle fallback (e.g. Local AI)
        return await provider.chat((providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.model) || "", messages, tools, providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.apiKey);
    }
}
export const aiManager = new AIManager();
