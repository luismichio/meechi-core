/**
 * NATIVE SERVER: GroqVoiceNative
 *
 * Cloud Voice capability for Groq.
 * Enables high-speed voice interaction when a Groq key is available.
 *
 * This is a "capability" native - it exposes UI features rather than AI tools.
 */
export class GroqVoiceNative {
    constructor(apiKey) {
        this.id = "native-groq-voice";
        this.name = "Native Cloud Voice (Groq)";
        this.description = "High-speed cloud voice interaction via Groq. Requires a valid API key.";
        this.isPermanent = false;
        this.apiKey = apiKey;
    }
    async getTools() {
        // Voice doesn't necessarily expose tools to the AI, 
        // it exposes capabilities to the UI.
        return [];
    }
    async executeTool(name, args) {
        throw new Error(`Tool ${name} not implemented in GroqVoiceNative`);
    }
    // Custom capability for the UI to check
    isVoiceReady() {
        return !!this.apiKey;
    }
}
