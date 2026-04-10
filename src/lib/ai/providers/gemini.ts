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

        const targetModel = model || "gemini-1.5-flash";

        let systemInstruction = "";
        const convertedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction += `${msg.content}\n`;
                continue;
            }

            convertedContents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            });
        }

        const geminiTools = tools?.length
            ? [{
                functionDeclarations: tools.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                })),
            }]
            : undefined;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: convertedContents,
                        generationConfig: {
                            temperature: 0.7,
                            topK: 1,
                            topP: 1,
                            maxOutputTokens: 4096,
                        },
                        ...(systemInstruction.trim()
                            ? { systemInstruction: { parts: [{ text: systemInstruction.trim() }] } }
                            : {}),
                        ...(geminiTools ? { tools: geminiTools } : {}),
                    }),
                }
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const payload = await response.json() as any;
            const candidate = payload?.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            const functionCalls = parts
                .map((part: any) => part?.functionCall)
                .filter((entry: any) => !!entry);

            if (functionCalls && functionCalls.length > 0) {
                return {
                    content: "",
                    tool_calls: functionCalls.map((fc: any) => ({
                        function: {
                            name: fc.name,
                            arguments: JSON.stringify(fc.args || {})
                        }
                    })),
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                };
            }

            const text = parts
                .map((part: any) => part?.text)
                .filter((entry: any) => typeof entry === 'string' && entry.length > 0)
                .join('\n');

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
