
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
export function parseToolCalls(content: string): ToolCall[] {
    const tools: ToolCall[] = [];
    
    // Regex for <function="name">{args}</function> or <function name='name'>{args}</function>
    // Improved to be more permissive with whitespace and attributes
    const toolRegex = /<function(?:=\s*["']?([^"'>]+)["']?|\s+name=["']?([^"'>]+)["']?)\s*>([\s\S]*?)<\/function>/gi;
    
    let match;
    while ((match = toolRegex.exec(content)) !== null) {
        // match[1] or match[2] is the name
        const name = (match[1] || match[2]).replace(/["']/g, "").trim();
        const argsStr = match[3].trim();
        
        try {
            // Attempt 1: Direct JSON parse
            const args = JSON.parse(argsStr);
            tools.push({ name, args, raw: match[0] });
        } catch (e) {
            // Attempt 2: Sanitize Common JSON Errors
            try {
                // 1. Handle Newlines in strings (LLMs often put literal newlines in JSON strings)
                // 2. Handle Markdown code blocks if they wrapped the JSON inside the XML (rare but happens)
                let cleaned = argsStr
                    .replace(/^```json\s*/i, '')
                    .replace(/\s*```$/, '');

                // Sanitize newlines inside double quotes
                cleaned = cleaned.replace(/"((?:[^"\\]|\\.)*)"/g, (m) => {
                    return m.replace(/\n/g, "\\n").replace(/\r/g, "");
                });

                const args = JSON.parse(cleaned);
                tools.push({ name, args, raw: match[0] });
            } catch (e2) {
                // Attempt 3: Aggressive Fixes (Last resort)
                try {
                    let fixed = argsStr
                        .replace(/'/g, '"') // Helper for single quotes
                        .replace(/,\s*}/g, '}') // Trailing commas
                        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); // Unquoted keys

                     // Re-sanitize strings
                    fixed = fixed.replace(/"((?:[^"\\]|\\.)*)"/g, (m) => m.replace(/\n/g, "\\n"));
                    
                    const args = JSON.parse(fixed);
                    tools.push({ name, args, raw: match[0] });
                } catch (e3) {
                    console.error(`Failed to parse args for tool ${name}`, argsStr);
                    tools.push({ name, args: {}, error: "Invalid JSON arguments", raw: match[0] });
                }
            }
        }
    }
    
    return tools;
}
