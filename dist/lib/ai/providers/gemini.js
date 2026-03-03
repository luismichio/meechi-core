export class GeminiProvider {
    constructor() {
        this.id = "gemini";
        this.name = "Google Gemini";
    }
    async chat(model, messages, tools, apiKey) {
        var _a, _b;
        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY;
        }
        if (!apiKey) {
            throw new Error("Gemini API Key is missing. Please set it in Settings or .env");
        }
        const targetModel = model || "gemini-1.5-flash";
        let systemInstruction = "";
        const convertedContents = [];
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
        const geminiTools = (tools === null || tools === void 0 ? void 0 : tools.length)
            ? [{
                    functionDeclarations: tools.map(t => ({
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters,
                    })),
                }]
            : undefined;
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.assign(Object.assign({ contents: convertedContents, generationConfig: {
                        temperature: 0.7,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                    } }, (systemInstruction.trim()
                    ? { systemInstruction: { parts: [{ text: systemInstruction.trim() }] } }
                    : {})), (geminiTools ? { tools: geminiTools } : {}))),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }
            const payload = await response.json();
            const candidate = (_a = payload === null || payload === void 0 ? void 0 : payload.candidates) === null || _a === void 0 ? void 0 : _a[0];
            const parts = ((_b = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _b === void 0 ? void 0 : _b.parts) || [];
            const functionCalls = parts
                .map((part) => part === null || part === void 0 ? void 0 : part.functionCall)
                .filter((entry) => !!entry);
            if (functionCalls && functionCalls.length > 0) {
                return {
                    content: "",
                    tool_calls: functionCalls.map((fc) => ({
                        function: {
                            name: fc.name,
                            arguments: JSON.stringify(fc.args || {})
                        }
                    })),
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                };
            }
            const text = parts
                .map((part) => part === null || part === void 0 ? void 0 : part.text)
                .filter((entry) => typeof entry === 'string' && entry.length > 0)
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
        }
        catch (error) {
            console.error("Gemini Provider Error:", error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    }
}
