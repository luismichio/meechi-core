type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';
export declare function useVoiceLoop(sendMessage: (text: string, onToken?: (chunk: string) => void) => Promise<string | void>): {
    start: () => Promise<void>;
    stop: () => void;
    stopPlayback: () => void;
    state: VoiceState;
    vadProb: number;
    transcript: string;
    playResponse: (text: string) => Promise<void>;
    isPlaying: boolean;
    getAnalyser: () => AnalyserNode | null;
};
export {};
