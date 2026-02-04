import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import React, { useEffect } from 'react';

interface SourceEditorProps {
    file: { content: string; path: string; metadata?: any };
    isEditing: boolean;
    onSave?: (content: string) => void;
    onRenderExtension?: (editor: any) => React.ReactNode;
}

export default function SourceEditor({ file, isEditing, onSave, onRenderExtension }: SourceEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
            Placeholder.configure({
                placeholder: 'Start typing...'
            }),
            TextStyle,
            Color,
            Link.configure({
                openOnClick: false
            })
        ],
        content: file.content,
        editable: isEditing,
        onUpdate: ({ editor }) => {
            // Optional: Auto-save or debounce logic
        },
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[200px]'
            }
        }
    });

    // Sync content if file changes externally
    useEffect(() => {
        if (editor && file.content !== (editor.storage as any).markdown.getMarkdown()) {
             editor.commands.setContent(file.content);
        }
    }, [file.path, editor]);

    // Save on Unmount or explicit save
    // (Simplified for now)

    if (!editor) return null;

    return (
        <div className="source-editor">
            {/* Toolbar Area (Generic + Slot) */}
            <div className="toolbar" style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                 {/* Basic Buttons could go here */}
                 {onRenderExtension && onRenderExtension(editor)}
            </div>
            
            <EditorContent editor={editor} style={{ padding: '1rem' }} />
        </div>
    );
}
