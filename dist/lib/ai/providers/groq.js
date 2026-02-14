import Groq from "groq-sdk";
export class GroqProvider {
    constructor() {
        this.id = "groq";
        this.name = "Groq";
    }
    async chat(model, messages, tools, apiKey) {
        if (!apiKey) {
            // Fallback to Env if not provided explicitly
            apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        }
        if (!apiKey) {
            throw new Error("Groq API Key is missing. Please set it in Settings or .env");
        }
        const groq = new Groq({ apiKey });
        console.log(`[Groq] Sending tools: ${(tools === null || tools === void 0 ? void 0 : tools.map(t => t.function.name).join(', ')) || 'None'}`);
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: model || "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                stream: false,
                stop: null,
                tools: tools,
                tool_choice: tools && tools.length > 0 ? "auto" : "none"
            });
            const choice = chatCompletion.choices[0];
            const message = choice === null || choice === void 0 ? void 0 : choice.message;
            return {
                content: (message === null || message === void 0 ? void 0 : message.content) || "",
                tool_calls: message === null || message === void 0 ? void 0 : message.tool_calls,
                usage: chatCompletion.usage
            };
        }
        catch (error) {
            console.error("Groq Provider Error:", error);
            throw new Error(`Groq Error: ${error.message}`);
        }
    }
}
