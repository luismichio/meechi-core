import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, AIChatMessage, AITool, AICompletion } from "../types";

export class GeminiProvider implements AIProvider {
    id = "gemini";
    name = "Google Gemini";

    async chat(
        model: string,
        messages: AIChatMessage[],
        tools?: AITool[],
        apiKey?: string
    ): Promise<AICompletion> {
        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY;
        }

        if (!apiKey) {
            throw new Error("Gemini API Key is missing. Please set it in Settings or .env");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ 
            model: model || "gemini-flash-latest"
        });

        // Gemini format conversion
        // Note: Gemini has specific rules about System prompts (must be separate)
        let systemInstruction = "";
        const history = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction += msg.content + "\n";
            } else if (msg.role === 'user') {
                history.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                history.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }

        // Configure generation config
        const generationConfig = {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        };
        
        // Map Tools to Gemini Format
        const geminiTools = tools?.map(t => ({
            functionDeclarations: [{
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }]
        }));

        try {
            const chatSession = geminiModel.startChat({
                history: history.slice(0, -1), // All but last
                generationConfig,
                systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
                tools: geminiTools
            });

            const lastMsg = history[history.length - 1];
            const result = await chatSession.sendMessage(lastMsg.parts[0].text);
            const response = await result.response;
            
            // Check for Function Calls
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                return {
                    content: "",
                    tool_calls: functionCalls.map((fc: any) => ({
                        function: {
                            name: fc.name,
                            arguments: JSON.stringify(fc.args)
                        }
                    })),
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                };
            }

            const text = response.text();

            return {
                content: text,
                usage: {
                   // Mock usage for now as Gemini doesn't always return standard usage obj in same format
                   prompt_tokens: 0,
                   completion_tokens: 0,
                   total_tokens: 0
                }
            };


        } catch (error: any) {
            console.error("Gemini Provider Error:", error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    }
}
