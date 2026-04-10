export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: number; // Unix ms — used for time-based context windowing
}

export interface AITool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

export interface AICompletion {
    content: string;
    tool_calls?: any[];
    usage?: any;
}

export interface AIProvider {
    id: string;
    name: string;
    
    chat(
        model: string,
        messages: AIChatMessage[],
        tools?: AITool[],
        apiKey?: string,
        onChunk?: (token: string) => void
    ): Promise<AICompletion>;
}
