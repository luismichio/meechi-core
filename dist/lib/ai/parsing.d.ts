export interface ToolCall {
    name: string;
    args: any;
    raw: string;
    error?: string;
}
/**
 * Parses tool calls from AI response text.
 * Supports XML format: <function="name">args</function>
 * Robust to common LLM formatting errors.
 */
export declare function parseToolCalls(content: string): ToolCall[];
