import Groq from "groq-sdk";
import { AIProvider, AIChatMessage, AITool, AICompletion } from "../types";

export class GroqProvider implements AIProvider {
    id = "groq";
    name = "Groq";

    async chat(
        model: string,
        messages: AIChatMessage[],
        tools?: AITool[],
        apiKey?: string
    ): Promise<AICompletion> {
        if (!apiKey) {
             // Fallback to Env if not provided explicitly
             apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        }

        if (!apiKey) {
            throw new Error("Groq API Key is missing. Please set it in Settings or .env");
        }

        const groq = new Groq({ apiKey });
        
        console.log(`[Groq] Sending tools: ${tools?.map(t => t.function.name).join(', ') || 'None'}`);

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: messages as any[],
                model: model || "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                stream: false,
                stop: null,
                tools: tools as any[],
                tool_choice: tools && tools.length > 0 ? "auto" : "none"
            });

            const choice = chatCompletion.choices[0];
            const message = choice?.message;

            return {
                content: message?.content || "",
                tool_calls: message?.tool_calls,
                usage: chatCompletion.usage
            };

        } catch (error: any) {
            console.error("Groq Provider Error:", error);
            throw new Error(`Groq Error: ${error.message}`);
        }
    }
}
