interface VoiceOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    sendMessage: (text: string) => Promise<string | void | undefined>;
}
export declare function VoiceOverlay({ isOpen, onClose, sendMessage }: VoiceOverlayProps): import("react/jsx-runtime").JSX.Element;
export {};
