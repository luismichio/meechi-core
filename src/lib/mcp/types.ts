export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
    handler: (args: any) => Promise<any>;
}

export interface McpResource {
    uri: string;
    name: string;
    mimeType?: string;
    description?: string;
    read: () => Promise<{ content: string; mimeType: string }>;
}

export interface McpRequest {
    method: string;
    params?: any;
    id?: string | number;
}

export interface McpResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id?: string | number;
}
