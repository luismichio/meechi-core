import React from 'react';
interface SourceEditorProps {
    file: {
        content: string;
        path: string;
        metadata?: any;
    };
    isEditing: boolean;
    onSave?: (content: string) => void;
    onRenderExtension?: (editor: any) => React.ReactNode;
}
export default function SourceEditor({ file, isEditing, onSave, onRenderExtension }: SourceEditorProps): import("react/jsx-runtime").JSX.Element | null;
export {};
