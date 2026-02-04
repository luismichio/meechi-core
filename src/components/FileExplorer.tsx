'use client';
import React, { useState, useEffect, useRef } from 'react';
import { StorageProvider, FileMeta } from '../lib/storage/types';
import styles from '../app/app/page.module.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FileRecord } from '../lib/storage/db';
import { extractTextFromPdf } from '../lib/pdf';
import Icon from './Icon';
import { extensions } from '../lib/extensions';

interface FileExplorerProps {
    storage: StorageProvider;
    onClose: () => void;
    syncLogs?: string[];
    onOpenFile?: (path: string) => void;
}

export default function FileExplorer(props: FileExplorerProps) {
    const { storage, onClose, onOpenFile } = props;
    const [currentPath, setCurrentPath] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('meechi_explorer_path') || 'misc';
        }
        return 'misc';
    });

    useEffect(() => {
        localStorage.setItem('meechi_explorer_path', currentPath);
    }, [currentPath]);
    
    // Actions State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Close menu on click outside - Use CAPTURE to handle before React bubbles
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
             // Don't close if clicking the kebab button OR inside the menu (let item handlers manage closure)
             if ((e.target as Element).closest(`.${styles.kebabButton}`) || (e.target as Element).closest(`.${styles.dropdownMenu}`)) return;
             setActiveMenuId(null);
        };
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, []);
    const lastInteractionIndex = useRef<number>(-1);

    // Dialog State
    type DialogAction = 
        | { type: 'rename', file: FileMeta, value: string } 
        | { type: 'delete', file: FileMeta }
        | { type: 'alert', title: string, message: string, onConfirm?: () => void }
        | { type: 'confirm', title: string, message: string, confirmLabel?: string, onConfirm: () => void };
    const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);

    // Link Dialog State
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [isFetchingLink, setIsFetchingLink] = useState(false);

    const showAlert = (title: string, message: string, onConfirm?: () => void) => {
        setDialogAction({ type: 'alert', title, message, onConfirm });
    };

    const handleAddLink = async () => {
        if (!linkUrl) return;
        setIsFetchingLink(true);
        try {
            const res = await fetch('/api/utils/fetch-url', {
                method: 'POST',
                body: JSON.stringify({ url: linkUrl }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // Create file
            const safeTitle = data.title.replace(/[^a-zA-Z0-9 \-_]/g, '').trim() || 'Untitled Source';
            const fileName = `${safeTitle}.source.md`;
            const path = `${currentPath}/${fileName}`;

            // Add Summary Wrapper if content is long? 
            // The prompt says: "create a md file with the parsed text, and summary in the beggining"
            
            // Generate Summary
            let finalContent = data.content;
            try {
                const sumRes = await fetch('/api/ai/summarize', {
                    method: 'POST',
                    body: JSON.stringify({ content: data.content }),
                    headers: { 'Content-Type': 'application/json' }
                });
                const sumData = await sumRes.json();
                if (sumData.summary) {
                    finalContent = `> **Summary**: ${sumData.summary}\n\n> **Source**: ${linkUrl}\n\n---\n\n${data.content}`;
                } else {
                     finalContent = `> **Source**: ${linkUrl}\n\n---\n\n${data.content}`;
                }
            } catch (e) {
                console.error("Summary failed", e);
                 finalContent = `> **Source**: ${linkUrl}\n\n---\n\n${data.content}`;
            }

            await storage.saveFile(path, finalContent);
            
            setIsLinkDialogOpen(false);
            setLinkUrl("");
            showAlert("Success", "Link added successfully!");

            await storage.saveFile(path, finalContent);
            
            setIsLinkDialogOpen(false);
            setLinkUrl("");
            showAlert("Success", "Link added successfully!");

        } catch (e: any) {
            showAlert("Error", "Failed to add link: " + e.message);
        } finally {
            setIsFetchingLink(false);
        }
    };

    // Initial Migration Trigger
    useEffect(() => {
        storage.init().catch(err => console.error("Migration failed", err));
    }, [storage]);

    // REACTIVE DATA FETCHING (Dexie Magic 🪄)
    const items = useLiveQuery(async () => {
        // Dynamic Query based on path
        // optimization: if path is "root", show top level folders?
        // Our structure implies everything starts with "misc/" or "history/".
        // Let's query EVERYTHING for now to ensure folders appear?
        // No, querying everything (startsWith("")) is better for discovery if we don't strictly enforce 'misc' root.
        
        let collection;
        const isRoot = currentPath === 'root';
        const queryPath = isRoot ? '' : currentPath;
        
        // simple prefix query
        const allFiles = await db.files.where('path').startsWith(queryPath).toArray();
        console.log(`[FileExplorer] Query '${queryPath}' returned ${allFiles.length} files.`, allFiles.map(f => f.path));

        const folders = new Set<string>();
        const currentLevelFiles: FileMeta[] = [];

        allFiles.filter(f => !f.deleted).forEach(f => {
            // Filter: Must start with currentPath + '/'
            // Special case: if isRoot, just look for top level dirs?
            
            let relative = "";
            if (isRoot) {
                 relative = f.path;
            } else {
                 if (!f.path.startsWith(currentPath + '/')) return;
                 relative = f.path.substring(currentPath.length + 1);
            }

            if (relative.includes('/')) {
                folders.add(relative.split('/')[0]);
            } else {
                // It's a file right here
                currentLevelFiles.push({
                    id: f.path,
                    name: f.path.split('/').pop() || f.path,
                    path: f.path,
                    updatedAt: f.updatedAt,
                    type: f.type,
                    remoteId: f.remoteId,
                    tags: f.tags,
                    metadata: f.metadata
                });
            }
        });



        // NotebookLM Style: Group "Source" files
        // If we have "foo.pdf" and "foo.pdf.source.md", hide "foo.pdf" and rename "foo.pdf.source.md" to "foo.pdf (Source)"
        
        // 1. Find all sources
        // 1. Find all sources and potential wrapper notes
        const sources = currentLevelFiles.filter(f => f.name.endsWith('.source.md'));
        const sourceMap = new Set(sources.map(s => s.name));
        const allFileNames = new Set(currentLevelFiles.map(f => f.name));

        // 2. Filter out raw PDFs if they have a source
        const finalFiles = currentLevelFiles.filter(f => {
             const isSource = f.name.endsWith('.source.md');
             if (isSource) return true;

             const potentialSourceName = f.name + '.source.md';
             if (sourceMap.has(potentialSourceName)) return false; // Hide raw PDF if Source exists
             
             const potentialNoteName = f.name + '.md';
             if (allFileNames.has(potentialNoteName)) return false; // Hide raw PDF if Converted Note exists
             
             return true;
        }).map(f => {
            if (f.name.endsWith('.source.md')) {
                return {
                    ...f,
                    name: f.name.replace('.pdf.source.md', ' (Source)'), // Nice display name
                    type: 'source' as const // New visual type?
                };
            }
            return f;
        });

        const folderItems: FileMeta[] = Array.from(folders)
            .filter(name => !currentLevelFiles.some(f => f.name === name && f.type === 'folder'))
            .map(name => ({
                id: isRoot ? name : `${currentPath}/${name}`,
                name: name,
                path: isRoot ? name : `${currentPath}/${name}`,
                updatedAt: Date.now(),
                type: 'folder' as const
            }));

        return [...folderItems, ...finalFiles].sort((a, b) => {
             if (a.type === b.type) return a.name.localeCompare(b.name);
             return a.type === 'folder' ? -1 : 1;
        });

    }, [currentPath]) || [];

    // Loading deleted (Dexie handles it)
    
    // ... existing handlers ...
    // Note: We no longer need to call loadFiles() manually after actions!
    // saveFile -> DB Update -> useLiveQuery triggers -> UI Updates automatically.
    
    const handleNavigate = (folderName: string) => {
        setCurrentPath(`${currentPath}/${folderName}`);
    };

    const handleBack = () => {
        if (currentPath === 'misc') return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleCreateFolder = async () => {
        const name = prompt("Topic Name:");
        if (!name) return;
        
        // Explicitly create folder record for sync
        const path = `${currentPath}/${name}`;
        await storage.createFolder(path);
    };

    const processFile = async (file: File, targetPath: string) => {
        const path = `${targetPath}/${file.name}`;
        
        let content = "";
        if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
             content = await file.text();
        } else if (file.type === 'application/pdf') {
             try {
                const buffer = await file.arrayBuffer();
                const extractedText = await extractTextFromPdf(buffer.slice(0));
                
                let finalContent = `## Source: ${file.name}\n\n${extractedText}`;
                try {
                    const res = await fetch('/api/ai/summarize', {
                        method: 'POST',
                        body: JSON.stringify({ content: extractedText }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await res.json();
                    if (data.summary) {
                        finalContent = `> **Summary**: ${data.summary}\n\n---\n\n${finalContent}`;
                    }
                } catch (e) {
                    console.error("Auto-summary failed", e);
                }
                
                const sourcePath = `${path}.source.md`;
                await storage.saveFile(sourcePath, finalContent);
                await storage.saveFile(path, buffer);
                return;
             } catch (e) {
                 console.error("PDF Upload Trace", e);
                 alert("Failed to parse PDF");
                 return;
             }
        } else {
             alert(`Skipped ${file.name}: Only text/markdown/pdf supported`);
             return;
        }

        let finalContent = content;
        try {
            const res = await fetch('/api/ai/summarize', {
                method: 'POST',
                body: JSON.stringify({ content }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.summary) {
                finalContent = `> **Summary**: ${data.summary}\n\n---\n\n${content}`;
            }
        } catch (e) {
            console.error("Auto-summary failed", e);
        }

        await storage.saveFile(path, finalContent);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file, currentPath);
    };    // loadFiles(); // Removed: Reactive
    

    // Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} items?`)) return;
        
        // Use db transaction for bulk delete?
        // For now, loop.
        for (const id of Array.from(selectedIds)) {
             const item = items.find(i => i.id === id);
             if (item) await performDelete(item);
        }
        setSelectedIds(new Set()); // Clear selection
    };

    const handleDeleteClick = (file: FileMeta) => {
        setDialogAction({ type: 'delete', file });
    };

    const confirmDelete = async () => {
        if (!dialogAction || dialogAction.type !== 'delete') return;
        const file = dialogAction.file;
        setDialogAction(null); // Close immediately

        try {
            await performDelete(file);
        } catch(e: any) {
            console.error("Delete failed:", e);
            alert("Delete Error: " + e.message);
        }
    };

    const performDelete = async (file: FileMeta) => {
        if (file.type === 'folder') {
            const all = await storage.listFiles(file.path);
            for (const f of all) {
                await storage.deleteFile(f.path);
            }
        } else if (file.type === 'source') {
             // Delete Source AND Original PDF
             await storage.deleteFile(file.path);
             const originalPath = file.path.replace('.source.md', '');
             try {
                 await storage.deleteFile(originalPath);
             } catch (e) {
                 console.warn("Could not delete original PDF (might not exist):", e);
             }
        } else {
            await storage.deleteFile(file.path);
            // Also check if there's a source for this file (if we deleted the raw PDF manually?)
            // Usually we hide raw PDF, but if we delete from search results or something.
            // Safe to check.
            if (file.path.endsWith('.pdf')) {
                const sourcePath = `${file.path}.source.md`;
                await storage.deleteFile(sourcePath); 
            }
        }
    };

    const handleRenameClick = (file: FileMeta) => {
        setDialogAction({ 
            type: 'rename', 
            file, 
            value: file.type === 'source' ? file.name.replace(' (Source)', '') : file.name 
        });
    };

    const confirmRename = async () => {
        if (!dialogAction || dialogAction.type !== 'rename') return;
        const { file, value: newName } = dialogAction;
        setDialogAction(null);

        if (!newName || newName === file.name) return;

        // Handle Source Rename
        if (file.type === 'source') {
             const oldSourcePath = file.path;
             const oldPdfPath = oldSourcePath.replace('.source.md', '');
             const oldPdfName = oldPdfPath.split('/').pop() || '';
             
             let newPdfName = newName;
             if (!newPdfName.endsWith('.pdf')) newPdfName += '.pdf';
             
             if (newPdfName === oldPdfName) return;
             
             const parentDir = oldPdfPath.substring(0, oldPdfPath.lastIndexOf('/'));
             const newPdfPath = `${parentDir}/${newPdfName}`;
             const newSourcePath = `${newPdfPath}.source.md`;
             
             try {
                // Try rename PDF first
                try {
                    await storage.renameFile(oldPdfPath, newPdfPath);
                } catch (err) {
                    console.warn("Could not rename original PDF (might not exist):", err);
                }
                // Always rename Source
                await storage.renameFile(oldSourcePath, newSourcePath);
             } catch (e: any) {
                 alert("Rename failed: " + e.message);
             }
             return;
        }

        const oldPath = file.path;
        const parts = oldPath.split('/');
        parts.pop();
        const newPath = `${parts.join('/')}/${newName}`;
        
        try {
            await storage.renameFile(oldPath, newPath);
        } catch (e: any) {
             alert("Rename failed: " + e.message);
        }
    };

    const handleToggleSourceStatus = async (file: FileMeta) => {
        try {
            // Fetch FRESH metadata from storage to ensure we don't lose 'edited' status
            const freshFile = await storage.getFile(file.path);
            if (!freshFile) {
                showAlert("Error", "File not found locally.");
                return;
            }

            const currentMeta = freshFile.metadata || {};

            if (file.type === 'source') {
                // Convert to Note: Rename .source.md -> .md
                const newPath = file.path.replace('.source.md', '.md');
                await storage.renameFile(file.path, newPath);
                
                // Preserve existing metadata (including 'edited'), just flip isSource
                await storage.updateMetadata(newPath, { type: 'file', metadata: { ...currentMeta, isSource: false } });
                
                showAlert("Success", `Converted "${file.name}" to Note.`);
            } else {
                // Convert to Source: Rename .md -> .source.md
                let newPath = file.path;
                if (!newPath.endsWith('.source.md')) {
                    if (newPath.endsWith('.md')) {
                        newPath = newPath.replace(/\.md$/, '.source.md');
                    } else {
                        newPath = newPath + '.source.md'; // Fallback
                    }
                }
                
                await storage.renameFile(file.path, newPath);
                await storage.updateMetadata(newPath, { type: 'source', metadata: { ...currentMeta, isSource: true } });
                
                showAlert("Success", `Converted "${file.name}" to Source.`);
            }
        } catch (e: any) {
            console.error(e);
            showAlert("Error", "Conversion failed: " + e.message);
        }
    };


    const handleResetSource = async (file: FileMeta) => {
        if (file.type !== 'source') return;
        
        const performReset = async () => {
             setDialogAction(null);
             try {
                let pdfContent: ArrayBuffer | undefined;
                const originalPath = file.path.replace('.source.md', '');
                const rawFile = await storage.readFile(originalPath);
                
                if (!rawFile) throw new Error("Original PDF file not found. Cannot reset.");
                if (rawFile instanceof ArrayBuffer) {
                     pdfContent = rawFile;
                } else if (typeof rawFile === 'string') {
                     throw new Error("Expected binary PDF, got text.");
                }

                if (!pdfContent) throw new Error("Could not read binary content.");
                let content = await extractTextFromPdf(pdfContent);
                 
                const displayName = file.name.replace(' (Source)', '');
                content = `## Source: ${displayName}\n\n${content}`; 

                const meta = file.metadata || {};
                const newMeta = { ...meta, edited: false, comments: [] };
                await storage.saveFile(file.path, content, undefined, file.tags, newMeta);
                
                showAlert("Success", "Source reset to original content.");
             } catch (e: any) {
                 console.error("Reset failed", e);
                 showAlert("Error", "Reset failed: " + e.message);
             }
        };

        setDialogAction({
            type: 'confirm',
            title: 'Reset Source',
            message: `Reset "${file.name}" to original? This will discard all edits and re-extract text from the PDF.`,
            confirmLabel: 'Reset',
            onConfirm: performReset
        });
    };

    const handleSelectionClick = (item: FileMeta, index: number, event: React.MouseEvent) => {
        event.stopPropagation();
        
        const newSelected = new Set(selectedIds);
        
        if (event.shiftKey && lastInteractionIndex.current !== -1) {
            // Range Select
            const start = Math.min(lastInteractionIndex.current, index);
            const end = Math.max(lastInteractionIndex.current, index);
            
            for (let i = start; i <= end; i++) {
                newSelected.add(items[i].id);
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Toggle
            if (newSelected.has(item.id)) newSelected.delete(item.id);
            else newSelected.add(item.id);
            lastInteractionIndex.current = index;
        } else {
            // Single Select (clears others) - Standard Logic
            // If user just clicks a checkbox, they usually expect "Add to selection" or "Toggle"
            // But if they click the *row*, they expect "Select Only This".
            // Since this is triggered by the checkbox click (mostly), let's keep it as Toggle logic if strictly checking box?
            // Actually, Windows Explorer: Checkbox click = Toggle. Row Click = Select Only This.
            // Let's assume this handles the Checkbox Click for now.
            
            if (newSelected.has(item.id)) newSelected.delete(item.id);
            else newSelected.add(item.id);
            lastInteractionIndex.current = index;
        }

        setSelectedIds(newSelected);
    };

    const handleRowClick = (item: FileMeta, index: number, event: React.MouseEvent) => {
         // Desktop Standard: Row Click = Select Only This (unless Cmd/Ctrl/Shift)
         const newSelected = new Set(selectedIds);
         
         if (event.shiftKey && lastInteractionIndex.current !== -1) {
            const start = Math.min(lastInteractionIndex.current, index);
            const end = Math.max(lastInteractionIndex.current, index);
            // Clear prior if Shift click? Usually Shift+Click keeps others? 
            // Standard: Shift+Click extends selection from anchor.
            // Simplified: Add range.
            for (let i = start; i <= end; i++) {
                newSelected.add(items[i].id);
            }
         } else if (event.ctrlKey || event.metaKey) {
             if (newSelected.has(item.id)) newSelected.delete(item.id);
             else newSelected.add(item.id);
             lastInteractionIndex.current = index;
         } else {
             // Single Click -> Select ONLY this
             newSelected.clear();
             newSelected.add(item.id);
             lastInteractionIndex.current = index;
         }
         setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // DRAG AND DROP
    const handleDragStart = (e: React.DragEvent, item: FileMeta) => {
        // ... (lines 258-268)
        // If the item is in current selection, drag ALL selected
        // Else just drag this one
        let dragIds = [item.id];
        if (selectedIds.has(item.id)) {
            dragIds = Array.from(selectedIds);
        }
        
        e.dataTransfer.setData('application/json', JSON.stringify(dragIds));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetFolder: FileMeta) => {
        e.preventDefault();
        e.stopPropagation();

        if (targetFolder.type !== 'folder') return;
        
        const raw = e.dataTransfer.getData('application/json');
        
        // 1. External File Drop
        if (!raw) {
             if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                 const files = Array.from(e.dataTransfer.files);
                 for (const file of files) {
                     await processFile(file, targetFolder.path);
                 }
             }
             return;
        }

        // 2. Internal Move
        const ids = JSON.parse(raw) as string[];

        // Filter out if trying to drop into self
        if (ids.includes(targetFolder.id)) return;

        // Move Logic
        for (const id of ids) {
            const item = items.find(i => i.id === id);
            if (!item) continue;
            
            // Folder Move or File Move?
            // Simplified: We assume flat structure support for now in `renameFile`
            // Old Path: misc/A.txt
            // New Path: misc/Folder/A.txt
            
            const newPath = `${targetFolder.path}/${item.name}`;
            try {
                // If it's a folder, we need recursive move?
                // IndexedDB 'folder' is virtual.
                // We actually need to find ALL files starting with item.path and replace prefix.
                // Does storage.renameFile support directory rename?
                // Our implementation in local.ts handles Single File rename.
                // We need to upgrade performMove to handle folders.
                await performMove(item, newPath);

            } catch(err) {
                console.error("Move failed", err);
            }
        }
        // loadFiles(); // Removed: Reactive
    };

    const performMove = async (item: FileMeta, newPath: string) => {
         if (item.type === 'file') {
             await storage.renameFile(item.path, newPath);
         } else {
             // Folder Move: Rename prefix for all children
             // Get all files with prefix `item.path/`
             // e.g. misc/OldFolder/... -> misc/NewFolder/...
             const allChilds = await storage.listFiles(item.path); // uses startsWith
             
             // Target Folder Path is derived from newPath (which includes the folder name)
             // item.path = misc/OldFolder
             // newPath = misc/Target/OldFolder
             
             for (const child of allChilds) {
                 const relative = child.path.substring(item.path.length); // /file.txt
                 const childNewPath = `${newPath}${relative}`;
                 await storage.renameFile(child.path, childNewPath);
             }
             
             // If local.ts implementation of renameFile handles copy+delete, this works.
         }
    };




    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: '80%', maxWidth: 800, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header ... (unchanged) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Topic Explorer</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--foreground)' }}>×</button>
                </div>

                {/* Toolbar ... (unchanged) */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <button onClick={handleBack} disabled={currentPath === 'misc'} style={{  
                        cursor: currentPath === 'misc' ? 'default' : 'pointer', 
                        opacity: currentPath === 'misc' ? 0 : 1,
                        background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4,
                        color: 'var(--foreground)'
                    }}>
                        <Icon name="ArrowLeft" size={18} /> Back
                    </button>
                    
                    <button onClick={() => {
                        setIsBulkMode(!isBulkMode);
                        if (isBulkMode) setSelectedIds(new Set()); 
                    }} style={{ 
                        cursor: 'pointer', 
                        background: isBulkMode ? 'var(--info)' : 'transparent', 
                        color: isBulkMode ? 'var(--surface)' : 'var(--foreground)',
                        border: '1px solid var(--border)', 
                        borderRadius: 4, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 
                    }}>
                        {isBulkMode ? <Icon name="CheckSquare" size={16} /> : <Icon name="Square" size={16} />} Select
                    </button>

                    {isBulkMode && (
                        <button onClick={handleSelectAll} style={{ cursor: 'pointer' }}>
                            {selectedIds.size === items.length && items.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    )}

                    {isBulkMode && selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} style={{ color: 'var(--error)', cursor: 'pointer', background: 'none', border:'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="Trash2" size={16} /> Delete ({selectedIds.size})
                        </button>
                    )}

                    <div style={{ flex: 1 }} />
                    <button onClick={async () => {
                        if (confirm("Reset connection to Google Drive? This will re-upload all files to 'Meechi Journal'.")) {
                            await storage.resetSyncState();
                            alert("Sync Reset. Please Sign Out and Sign In again to refresh permissions.");
                        }
                    }} style={{ cursor: 'pointer', marginRight: '1rem', color: 'var(--error)', border: '1px solid var(--error)', background: 'transparent', borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem' }}>
                        Reset Cloud
                    </button>
                    {props.syncLogs && (
                        <button onClick={async () => {
                            if (storage.forceSync) {
                                await storage.forceSync();
                                await storage.forceSync();
                                await storage.forceSync(); // Triple sync hack
                                showAlert("Sync", "Sync triggered!");
                            } else {
                                showAlert("Sync", "Sync not available");
                            }
                        }} style={{ cursor: 'pointer', marginRight: '1rem', color: 'var(--info)', border: '1px solid var(--info)', background: 'transparent', borderRadius: 4, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="RefreshCw" size={14} /> Sync Now
                        </button>
                    )}
                    <button onClick={handleCreateFolder} style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--foreground)' }}>
                        <Icon name="FolderPlus" size={18} /> New Topic
                    </button>
                    <button onClick={() => setIsLinkDialogOpen(true)} style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--foreground)' }}>
                        <Icon name="Link" size={18} /> Add Link
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--foreground)' }}>
                        <Icon name="Upload" size={18} /> Upload Logic
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                </div>

                {/* Breadcrumb ... (unchanged) */}
                <div style={{ padding: '0.5rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 4, marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--secondary)', display: 'flex', gap: '0.5rem' }}>
                     {currentPath.split('/').map((part, index, arr) => {
                         // ... breadcrumb logic ...
                         const pathSoFar = arr.slice(0, index + 1).join('/');
                         const isLast = index === arr.length - 1;
                         const targetFolder: FileMeta = { id: pathSoFar, name: part, path: pathSoFar, updatedAt: Date.now(), type: 'folder' };

                         return (
                            <React.Fragment key={pathSoFar}>
                                <span 
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                    onDrop={(e) => handleDrop(e, targetFolder)}
                                    onClick={() => !isLast && setCurrentPath(pathSoFar)}
                                    style={{ 
                                        cursor: isLast ? 'default' : 'pointer', 
                                        fontWeight: isLast ? 600 : 400,
                                        textDecoration: isLast ? 'none' : 'underline'
                                    }}
                                >
                                    {part === 'misc' ? 'Home' : part}
                                </span>
                                {!isLast && <Icon name="ChevronRight" size={14} style={{ color: 'var(--muted)' }} />}
                            </React.Fragment>
                         );
                     })}
                </div>

                {/* Dialog Overlay */}
                {(dialogAction || isLinkDialogOpen) && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }} onClick={(e) => { e.stopPropagation(); setDialogAction(null); setIsLinkDialogOpen(false); }}>
                        <div style={{ background: 'var(--surface)', color: 'var(--foreground)', padding: '1.5rem', borderRadius: 8, width: 300, border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                            {isLinkDialogOpen && (
                                <>
                                    <h3 style={{ margin: '0 0 1rem 0' }}>Add Link Source</h3>
                                    <input 
                                        autoFocus
                                        placeholder="https://example.com/article"
                                        value={linkUrl} 
                                        onChange={e => setLinkUrl(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1.5rem' }} 
                                    />
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setIsLinkDialogOpen(false)} style={{ color: 'var(--foreground)', background: 'none', border: '1px solid var(--border)', padding: '0.5rem 1rem', borderRadius: 4 }}>Cancel</button>
                                        <button onClick={handleAddLink} disabled={isFetchingLink} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4 }}>
                                            {isFetchingLink ? 'Fetching...' : 'Add'}
                                        </button>
                                    </div>
                                </>
                            )}
                            {dialogAction && dialogAction.type === 'delete' && (
                                <>
                                    <h3 style={{ margin: '0 0 1rem 0' }}>Confirm Delete</h3>
                                    <p style={{ marginBottom: '1.5rem' }}>Delete <b>{dialogAction.file.name}</b>?</p>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setDialogAction(null)}>Cancel</button>
                                        <button onClick={confirmDelete} style={{ background: '#ff4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4 }}>Delete</button>
                                    </div>
                                </>
                            )}
                            {dialogAction && dialogAction.type === 'alert' && (
                                <>
                                    <h3 style={{ margin: '0 0 1rem 0' }}>{dialogAction.title}</h3>
                                    <p style={{ marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>{dialogAction.message}</p>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => {
                                            if (dialogAction.onConfirm) dialogAction.onConfirm();
                                            setDialogAction(null);
                                        }} style={{ background: '#007bff', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4 }}>OK</button>
                                    </div>
                                </>
                            )}
                            {dialogAction && dialogAction.type === 'confirm' && (
                                <>
                                    <h3 style={{ margin: '0 0 1rem 0' }}>{dialogAction.title}</h3>
                                    <p style={{ marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>{dialogAction.message}</p>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setDialogAction(null)}>Cancel</button>
                                        <button onClick={() => {
                                            dialogAction.onConfirm();
                                            // Dialog close handling is up to the caller usually? 
                                            // But for consistent UI, we might want to auto-close if the caller doesn't?
                                            // The caller of confirm usually sets state.
                                            // But looking at performSummarise logic I added "setDialogAction(null)" inside.
                                            // However, let's keep it safe.
                                        }} style={{ background: '#007bff', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4 }}>
                                            {dialogAction.confirmLabel || 'Confirm'}
                                        </button>
                                    </div>
                                </>
                            )}
                            {dialogAction && dialogAction.type === 'rename' && (
                                <>
                                    <h3 style={{ margin: '0 0 1rem 0' }}>Rename File</h3>
                                    <input 
                                        autoFocus
                                        value={dialogAction.value} 
                                        onChange={e => setDialogAction({ ...dialogAction, value: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && confirmRename()}
                                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1.5rem' }} 
                                    />
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setDialogAction(null)}>Cancel</button>
                                        <button onClick={confirmRename} style={{ background: '#007bff', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 4 }}>Rename</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {/* File Grid */}
                <div 
                    style={{ flex: 1, overflowY: 'auto' }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        // Target is currentPath
                        await handleDrop(e, { id: currentPath, name: currentPath.split('/').pop() || 'root', path: currentPath, type: 'folder', updatedAt: 0 });
                    }}
                >
                    {items.length === 0 && <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Empty Topic (Drop files here)</div>}
                    
                    {items.map((item, index) => (
                        <div key={item.id} 
                            className={`${styles.fileRow} ${selectedIds.has(item.id) ? styles.selected : ''}`}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragOver={(e) => item.type === 'folder' ? handleDragOver(e) : undefined}
                            onDrop={(e) => item.type === 'folder' ? handleDrop(e, item) : undefined}
                            onClick={(e) => handleRowClick(item, index, e)}
                            style={{
                                background: selectedIds.has(item.id) ? 'var(--accent)' : undefined,
                                color: selectedIds.has(item.id) ? '#fff' : undefined, // Force white text on accent
                                borderRadius: 6
                            }}
                            onDoubleClick={() => {
                                if (item.type === 'folder') {
                                    handleNavigate(item.name);
                                } else {
                                    // Open file
                                    if (onOpenFile) {
                                        onOpenFile(item.path);
                                    } else {
                                        onClose(); 
                                        window.open(`/q?file=${encodeURIComponent(item.path)}`, '_self');
                                    }
                                }
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                {isBulkMode && (
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(item.id)} 
                                        readOnly 
                                        onClick={(e) => handleSelectionClick(item, index, e)}
                                    />
                                )}
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                    <span style={{ color: selectedIds.has(item.id) ? 'currentColor' : '#666', display: 'flex', alignItems: 'center' }}>
                                        {item.type === 'folder' ? 
                                            <Icon name="Folder" size={20} fill="currentColor" fillOpacity={selectedIds.has(item.id) ? 0.3 : 0.2} /> : 
                                            (item.type === 'source' ? 
                                                (item.metadata?.edited ? <Icon name="BookOpen" size={20} /> : <Icon name="Book" size={20} />) : 
                                                <Icon name="FileText" size={20} />
                                            )
                                        }
                                    </span>
                                    <span style={{ fontWeight: item.type === 'folder' ? 600 : 400 }}>{item.name}</span>
                                </div>
                            </div>


                            <div style={{ position: 'relative' }}>
                                <button 
                                    className={`${styles.kebabButton} ${activeMenuId === item.id ? styles.active : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === item.id ? null : item.id); }}
                                >
                                    <Icon name="MoreVertical" size={16} />
                                </button>
                                
                                {activeMenuId === item.id && (
                                    <div className={styles.dropdownMenu} onClick={e => e.stopPropagation()} style={{ left: 'auto', right: 0 }}>
                                        <button className={styles.dropdownItem} onClick={() => { setActiveMenuId(null); handleRenameClick(item); }}>
                                            Rename
                                        </button>
                                        
                                        {extensions.getFileActions().map(action => (
                                            (!action.shouldShow || action.shouldShow(item)) && (
                                                <button 
                                                    key={action.id}
                                                    className={styles.dropdownItem} 
                                                    onClick={async () => { 
                                                        setActiveMenuId(null); 
                                                        try {
                                                            await action.handler(item, { storage });
                                                        } catch (err: any) {
                                                            showAlert("Error", err.message || String(err));
                                                        }
                                                    }}
                                                >
                                                    {action.icon && <Icon name={(action.icon as any).name} size={16} style={{marginRight: 8}} />}
                                                    {action.label}
                                                </button>
                                            )
                                        ))}

                                        {item.type === 'source' ? (
                                            <>
                                                {item.metadata?.edited && (
                                                    <button className={styles.dropdownItem} onClick={() => { setActiveMenuId(null); handleResetSource(item); }}>
                                                        Reset Source
                                                    </button>
                                                )}
                                                <button className={styles.dropdownItem} onClick={() => { setActiveMenuId(null); handleToggleSourceStatus(item); }}>
                                                    Convert to Note
                                                </button>
                                            </>
                                        ) : (
                                            <button className={styles.dropdownItem} onClick={() => { setActiveMenuId(null); handleToggleSourceStatus(item); }}>
                                                Make Source
                                            </button>
                                        )}

                                        <button className={`${styles.dropdownItem} ${styles.delete}`} onClick={() => { setActiveMenuId(null); handleDeleteClick(item); }}>
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sync Log Panel */}
                <div style={{ marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                           <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Live Sync Log</h4>
                           <button 
                               onClick={() => navigator.clipboard.writeText((props.syncLogs || []).join('\n'))}
                               style={{ border: 'none', background: 'none', color: '#007bff', cursor: 'pointer', fontSize: '0.7rem' }}
                           >
                               Copy
                           </button>
                       </div>
                       <div style={{ 
                           background: '#f8f8f8', 
                           padding: '8px', 
                           borderRadius: '4px', 
                           height: '100px', 
                           overflowY: 'auto', 
                           fontSize: '0.7rem', 
                           fontFamily: 'monospace',
                           border: '1px solid #eee',
                           display: 'flex', flexDirection: 'column', gap: '2px'
                       }}>
                           {(props.syncLogs || []).length === 0 && <span style={{color: '#999', fontStyle: 'italic'}}>Waiting for logs...</span>}
                           {(props.syncLogs || []).slice().reverse().map((log, i) => (
                               <div key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>{log}</div>
                           ))}
                       </div>
                    </div>

                    <details>
                        <summary style={{ cursor: 'pointer', color: '#666', fontSize: '0.85rem' }}>Storage Maintenance</summary>
                        <div style={{ padding: '1rem', background: '#f9f9f9', borderRadius: 4, marginTop: '0.5rem', border: '1px solid #eee' }}>
                           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button onClick={async () => {
                                    const all = await db.files.count();
                                    const deleted = await db.files.where('deleted').equals(1).count();
                                    const dirty = await db.files.where('dirty').equals(1).count();
                                    showAlert("Stats", `Total: ${all}\nTrash: ${deleted}\nUnsynced: ${dirty}`);
                                }} style={{ padding: '4px 8px' }}>
                                    Check Stats
                                </button>
                                
                                <button onClick={async () => {
                                    if (confirm("Restore ALL items from trash?")) {
                                        await db.transaction('rw', db.files, async () => {
                                             await db.files.where('deleted').equals(1).modify({ deleted: 0, dirty: 1 });
                                        });
                                        alert("Items restored.");
                                    }
                                }} style={{ padding: '4px 8px' }}>
                                    Empty Trash
                                </button>
                                
                                <button onClick={async () => {
                                     if (confirm("PERMANENTLY delete all items in trash?")) {
                                         await db.files.where('deleted').equals(1).delete();
                                         alert("Trash purged.");
                                     }
                                }} style={{ padding: '4px 8px', color: 'red' }}>
                                    Purge Trash
                                </button>

                                <button onClick={async () => {
                                    if (prompt("Type 'DELETE' to confirm Factory Reset. This wipes ALL local data.") === 'DELETE') {
                                        await storage.factoryReset();
                                        window.location.reload();
                                    }
                                }} style={{ padding: '4px 8px', color: 'white', background: 'red', fontWeight: 'bold' }}>
                                   FACTORY RESET
                                </button>
                           </div>
                        </div>
                    </details>
                </div>

            </div>
        </div>
    );
}
