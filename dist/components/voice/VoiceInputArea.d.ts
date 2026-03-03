interface VoiceInputAreaProps {
    meechi: any;
    chatInput: string;
    setChatInput: (val: string) => void;
    isDragOver: boolean;
    setIsDragOver: (val: boolean) => void;
    attachedFiles: any[];
    setAttachedFiles: (files: any[]) => void;
    handleChat: (e: any) => void;
    storage: any;
    processUserMessage: (text: string, onToken?: (chunk: string) => void) => Promise<string | void>;
}
export declare function VoiceInputArea({ meechi, chatInput, setChatInput, isDragOver, setIsDragOver, attachedFiles, setAttachedFiles, handleChat, storage, processUserMessage }: VoiceInputAreaProps): import("react/jsx-runtime").JSX.Element;
export {};
