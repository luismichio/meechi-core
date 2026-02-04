import { McpTool, McpResource } from './types';

/**
 * Basic interface for ANY MCP Server (Internal or External)
 */
export interface McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean; // Cannot be unplugged (e.g. MeechiCore)
    isAgenticMemory?: boolean; // Memory-based agents (for tier limits)
    getTools(): Promise<McpTool[]>;
    getResources?(): Promise<McpResource[]>;
    executeTool(name: string, args: any): Promise<any>;
    getSystemInstructions?(): Promise<string>; // Persona injection (Async for memory lookup)
}

export type MeechiTier = 'tier1' | 'tier2' | 'tier3';

/**
 * The Central Registry that manages "Slotted" MCP Servers.
 */
export class McpRegistry {
    private servers: Map<string, McpConnector> = new Map();
    private activeSlots: Set<string> = new Set();
    private activeMemories: Set<string> = new Set();
    private tier: MeechiTier = 'tier1';

    private TIER_CONSTRAINTS = {
        tier1: { maxSlots: 2, maxMemories: 5 },
        tier2: { maxSlots: 10, maxMemories: 5 },
        tier3: { maxSlots: -1, maxMemories: 5 } // Unlimited slots, 5 agents
    };

    constructor(tier: MeechiTier = 'tier1') {
        this.tier = tier;
    }

    setTier(tier: MeechiTier) {
        this.tier = tier;
    }

    getMaxSlots(): number {
        return this.TIER_CONSTRAINTS[this.tier].maxSlots;
    }

    registerServer(server: McpConnector) {
        this.servers.set(server.id, server);
        if (server.isPermanent) {
            this.activeSlots.add(server.id);
        }
    }

    activateSlot(serverId: string): boolean {
        const server = this.servers.get(serverId);
        if (!server) return false;
        if (this.activeSlots.has(serverId)) return true;
        
        const constraints = this.TIER_CONSTRAINTS[this.tier];

        // Agentic Memory Specific Logic (Uses interface flag, not hardcoded IDs)
        const isAgentic = server.isAgenticMemory === true;
        if (isAgentic) {
            if (this.activeMemories.size >= constraints.maxMemories) {
                // Return false or throw error for UI to catch
                throw new Error(`Memory limit reached. You can have up to ${constraints.maxMemories} active memories. Please deactivate one first.`);
            }
            this.activeMemories.add(serverId);
            this.activeSlots.add(serverId);
            return true;
        }

        // Generic Marketplace Logic
        const nonPermanentCount = Array.from(this.activeSlots).filter(id => {
            const s = this.servers.get(id);
            return !s?.isPermanent && !s?.isAgenticMemory;
        }).length;
        
        if (constraints.maxSlots !== -1 && nonPermanentCount >= constraints.maxSlots) {
            throw new Error(`Slot limit reached (${constraints.maxSlots}). Please upgrade your plan for more slots.`);
        }

        this.activeSlots.add(serverId);
        return true;
    }

    deactivateSlot(serverId: string) {
        const server = this.servers.get(serverId);
        if (server?.isPermanent) return; 
        this.activeSlots.delete(serverId);
        this.activeMemories.delete(serverId);
    }

    async getAllTools(): Promise<McpTool[]> {
        let allTools: McpTool[] = [];
        for (const serverId of this.activeSlots) {
            const server = this.servers.get(serverId);
            if (server) {
                const tools = await server.getTools();
                allTools = [...allTools, ...tools];
            }
        }
        return allTools;
    }

    async executeTool(name: string, args: any): Promise<any> {
        // Find which server has this tool
        for (const serverId of this.activeSlots) {
            const server = this.servers.get(serverId);
            if (server) {
                const tools = await server.getTools();
                if (tools.find(t => t.name === name)) {
                    return await server.executeTool(name, args);
                }
            }
        }
        throw new Error(`Tool ${name} not found in any active MCP slots.`);
    }

    async getCombinedInstructions(): Promise<string> {
        let instructions = "";
        for (const serverId of this.activeMemories) {
            const server = this.servers.get(serverId);
            if (server?.getSystemInstructions) {
                const instructionsText = await server.getSystemInstructions();
                instructions += `\n\n--- PERSONA: ${server.name} ---\n${instructionsText}\n`;
            }
        }
        return instructions;
    }

    /**
     * Gets instructions for a SPECIFIC agent (e.g. for Mode switching)
     */
    async getAgentInstructions(agentId: string): Promise<string | null> {
        const server = this.servers.get(agentId);
        return server?.getSystemInstructions ? await server.getSystemInstructions() : null;
    }

    getMarketplace() {
        return Array.from(this.servers.values()).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            isActive: this.activeSlots.has(s.id),
            isPermanent: s.isPermanent
        }));
    }
}

export const mcpRegistry = new McpRegistry();
