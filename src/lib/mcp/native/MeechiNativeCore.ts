import { McpTool, McpResource } from '../types';
import { McpConnector } from '../McpRegistry';
import { LocalStorageProvider } from '../../storage/local';
import { extractTextFromPdf } from '../../pdf';
import * as cheerio from 'cheerio';

/**
 * NATIVE SERVER: MeechiNativeCore
 * 
 * The permanent, mandatory internal tool provider.
 * Contains core file management and knowledge tools.
 * 
 * This is a "Native" server - an in-process TypeScript class that follows
 * the MCP interface pattern but does NOT use the actual MCP protocol
 * (no JSON-RPC, no IPC). It's part of the same runtime as the host.
 */
export class MeechiNativeCore implements McpConnector {
    id = "native-core";
    name = "Native Core";
    description = "Permanent system tools for file management, PDF reading, and settings.";
    isPermanent = true;

    private tools: Map<string, McpTool> = new Map();
    private storage: LocalStorageProvider;

    constructor() {
        this.storage = new LocalStorageProvider();
        this.registerTools();
    }

    private registerTools() {
        this.addTool({
            name: "create_file",
            description: "Create a new file in the knowledge base. ONLY use this when the user EXPLICITLY asks to save, create, or store something. NEVER use this spontaneously.",
            inputSchema: {
                type: "object",
                properties: {
                    filePath: { type: "string" },
                    content: { type: "string" }
                },
                required: ["filePath", "content"]
            },
            handler: async (args) => {
                await this.storage.init();
                let cleanPath = args.filePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
                if (!cleanPath.startsWith('misc/') && !cleanPath.startsWith('history/')) {
                    cleanPath = `misc/${cleanPath}`;
                }
                if (cleanPath.endsWith('.source.md')) {
                    throw new Error("Safety Block: Source files are immutable.");
                }
                await this.storage.saveFile(cleanPath, args.content);
                return { success: true, message: `Created ${cleanPath}` };
            }
        });

        this.addTool({
            name: "update_file",
            description: "Update or overwrite an existing file. ONLY use this when the user EXPLICITLY asks to update or modify a file. NEVER use this spontaneously.",
            inputSchema: {
                type: "object",
                properties: {
                    filePath: { type: "string" },
                    newContent: { type: "string" }
                },
                required: ["filePath", "newContent"]
            },
            handler: async (args) => {
                await this.storage.init();
                let cleanPath = args.filePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
                if (!cleanPath.startsWith('misc/') && !cleanPath.startsWith('history/')) {
                    cleanPath = `misc/${cleanPath}`;
                }
                if (cleanPath.endsWith('.source.md')) {
                    throw new Error("Safety Block: Source files are immutable.");
                }
                await this.storage.updateFile(cleanPath, args.newContent);
                return { success: true, message: `Updated ${cleanPath}` };
            }
        });

        this.addTool({
            name: "move_file",
            description: "Move or rename a file. ONLY use this when the user EXPLICITLY asks to move or rename a file.",
            inputSchema: {
                type: "object",
                properties: {
                    sourcePath: { type: "string" },
                    destinationPath: { type: "string" }
                },
                required: ["sourcePath", "destinationPath"]
            },
            handler: async (args) => {
                await this.storage.init();
                let source = args.sourcePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
                let dest = args.destinationPath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
                if (!source.startsWith('misc/') && !source.startsWith('history/')) source = `misc/${source}`;
                if (!dest.startsWith('misc/') && !dest.startsWith('history/')) dest = `misc/${dest}`;

                const content = await this.storage.readFile(source);
                if (!content) throw new Error(`Source ${source} not found`);
                
                await this.storage.saveFile(dest, content as string);
                await this.storage.deleteFile(source);
                return { success: true, message: `Moved to ${dest}` };
            }
        });

        this.addTool({
            name: "read_pdf",
            description: "Extract text from a PDF file. ONLY use this for files ending in .pdf.",
            inputSchema: {
                type: "object",
                properties: { filePath: { type: "string" } },
                required: ["filePath"]
            },
            handler: async (args) => {
                await this.storage.init();
                const fileData = await this.storage.readFile(args.filePath);
                if (!fileData) throw new Error("File not found");
                
                let buffer: ArrayBuffer;
                if (fileData instanceof ArrayBuffer) buffer = fileData;
                else if (fileData instanceof Blob) buffer = await fileData.arrayBuffer();
                else throw new Error("Format error");

                const text = await extractTextFromPdf(buffer);
                return { success: true, data: text.substring(0, 50000) };
            }
        });

        this.addTool({
            name: "read_file",
            description: "Read the content of a file (markdown, text, code, etc). Use this if you need to read a file, but check if the user already provided it via citation first.",
            inputSchema: {
                type: "object",
                properties: { filePath: { type: "string" } },
                required: ["filePath"]
            },
            handler: async (args) => {
                await this.storage.init();
                const content = await this.storage.readFile(args.filePath);
                if (content === null) throw new Error("File not found");
                if (typeof content !== 'string') throw new Error("File is binary, use read_pdf if it is a PDF");
                return { success: true, data: content };
            }
        });

        this.addTool({
            name: "fetch_html",
            description: "Fetch a URL and return its text content. ONLY use this when the user explicitly provides a URL or asks to read a specific link. NEVER use this spontaneously.",
            inputSchema: {
                type: "object",
                properties: { url: { type: "string" } },
                required: ["url"]
            },
            handler: async (args) => {
                // Modified: Use Proxy to avoid CORS errors
                try {
                    const res = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: args.url })
                    });
                    
                    if (!res.ok) {
                        try {
                             const errObj = await res.json();
                            // If the API returns a specific error (like 404), tell the LLM
                             if (errObj.error) {
                                 // Add explicit instruction to not retry identically
                                 return { success: false, error: `Could not fetch page (${res.status}). Error: ${errObj.error}. DO NOT RETRY THIS EXACT URL.` };
                             }
                        } catch (e) {}
                        return { success: false, error: `Could not fetch page. Status: ${res.status} ${res.statusText}. It may be blocked. DO NOT RETRY THIS EXACT URL.` };
                    }
                    
                    const data = await res.json();
                    return { success: true, data: data.content, title: data.title };
                } catch (e: any) {
                    console.error("[NativeCore] Fetch Proxy Failed:", e);
                    // Return error to LLM so it can try another link
                    return { success: false, error: `Failed to read URL (${e.message}). Try a different source.` };
                }
            }
        });

        // query_rag, query_graph, and summarize_file are in the application layer

        this.addTool({
            name: "update_user_settings",
            description: "Update the user's profile settings (name, tone). ONLY use this when the user EXPLICITLY asks to change their name or how the AI speaks (tone). NEVER use this to 'update' the user's mood or feelings.",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    tone: { type: "string" }
                }
            },
            handler: async (args) => {
                const { settingsManager } = await import('../../settings');
                await settingsManager.updateIdentity({ name: args.name, tone: args.tone });
                return { success: true, message: "Settings updated" };
            }
        });
    }

    private addTool(tool: McpTool) {
        this.tools.set(tool.name, tool);
    }

    async getTools(): Promise<McpTool[]> {
        return Array.from(this.tools.values());
    }

    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Tool ${name} not found in MeechiNativeCore`);
        return await tool.handler(args);
    }
}
