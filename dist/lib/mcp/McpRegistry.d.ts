import { McpTool, McpResource } from './types';
/**
 * Basic interface for ANY MCP Server (Internal or External)
 */
export interface McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean;
    isAgenticMemory?: boolean;
    getTools(): Promise<McpTool[]>;
    getResources?(): Promise<McpResource[]>;
    executeTool(name: string, args: any): Promise<any>;
    getSystemInstructions?(): Promise<string>;
}
export type MeechiTier = 'tier1' | 'tier2' | 'tier3';
/**
 * The Central Registry that manages "Slotted" MCP Servers.
 */
export declare class McpRegistry {
    private servers;
    private activeSlots;
    private activeMemories;
    private tier;
    private TIER_CONSTRAINTS;
    constructor(tier?: MeechiTier);
    setTier(tier: MeechiTier): void;
    getMaxSlots(): number;
    registerServer(server: McpConnector): void;
    activateSlot(serverId: string): boolean;
    deactivateSlot(serverId: string): void;
    getAllTools(): Promise<McpTool[]>;
    executeTool(name: string, args: any): Promise<any>;
    getCombinedInstructions(): Promise<string>;
    /**
     * Gets instructions for a SPECIFIC agent (e.g. for Mode switching)
     */
    getAgentInstructions(agentId: string): Promise<string | null>;
    getMarketplace(): {
        id: string;
        name: string;
        description: string;
        isActive: boolean;
        isPermanent: boolean;
    }[];
}
export declare const mcpRegistry: McpRegistry;
