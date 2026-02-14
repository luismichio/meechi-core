import { AIChatMessage } from '../lib/ai/types';
export declare function useMeechi(): {
    isReady: boolean;
    localAIStatus: string;
    downloadProgress: {
        percentage: number;
        text: string;
    } | null;
    chat: (userMsg: string, history: AIChatMessage[], context: string, onUpdate: (chunk: string) => void, onToolStart?: (toolName: string) => void, onToolResult?: (result: string) => void) => Promise<void>;
    isLowPowerDevice: boolean;
    loadedModel: string | null;
    activeMemories: string[];
    mode: string;
    setMode: (m: string) => void;
    stop: () => Promise<void>;
};
