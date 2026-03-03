/**
 * NATIVE SERVER: LocalVoiceNative
 *
 * Experimental Local Voice capability.
 * Uses client-side ONNX models (Whisper/Kokoro) for private, offline interaction.
 *
 * This is a "capability" native - it exposes UI features rather than AI tools.
 */
export class LocalVoiceNative {
    constructor() {
        this.id = "native-local-voice";
        this.name = "Native Local Voice (Experimental)";
        this.description = "Privacy-first local voice interaction using browser-based STT (Whisper) and TTS (Kokoro). Experimental.";
        this.isPermanent = false;
    }
    async getTools() {
        // Local voice exposes internal capabilities through standard audio services.
        return [];
    }
    async executeTool(name, args) {
        throw new Error(`Tool ${name} not implemented in LocalVoiceNative`);
    }
    // Indicates this server is capable of providing voice services
    isVoiceCapable() {
        return true;
    }
}
