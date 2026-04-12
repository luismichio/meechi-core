import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useVoiceLoop } from '../../lib/hooks/use-voice-loop';
import { TranscriberService } from '../../lib/audio/stt';
import { SynthesizerService } from '../../lib/audio/tts';
import { settingsManager } from '../../lib/settings';
import { Mic, X, Square, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import styles from '../../app/app/page.module.css';
export function VoiceInputArea({ meechi, chatInput, setChatInput, isDragOver, setIsDragOver, attachedFiles, setAttachedFiles, handleChat, storage, processUserMessage }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const { start, stop, stopPlayback, state, vadProb, transcript, getAnalyser, isPlaying } = useVoiceLoop(processUserMessage);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const textareaRef = useRef(null);
    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
    }, [chatInput]);
    // Handle Voice Toggle
    const toggleVoice = () => {
        console.log("[VoiceInputArea] Toggle clicked. Current state:", isVoiceActive);
        if (isVoiceActive) {
            stop();
            stopPlayback(); // Cut speech immediately
            setIsVoiceActive(false);
        }
        else {
            console.log("[VoiceInputArea] Starting voice loop...");
            start().then(() => {
                console.log("[VoiceInputArea] Voice loop started successfully");
                setIsVoiceActive(true);
            }).catch(e => {
                console.error("[VoiceInputArea] Failed to start voice loop:", e);
            });
        }
    };
    useEffect(() => {
        console.log("[VoiceInputArea] Component Mounted - Preloading Models...");
        const preload = async () => {
            // 1. Configure Cloud STT if available
            const config = await settingsManager.getConfig();
            // Check Active Provider
            if (config.activeProviderId && config.activeProviderId !== 'local') {
                const provider = config.providers.find(p => p.id === config.activeProviderId);
                const key = (provider === null || provider === void 0 ? void 0 : provider.apiKey) || process.env.NEXT_PUBLIC_GROQ_API_KEY;
                if (key) {
                    console.log("[VoiceInputArea] Enabling Cloud STT & TTS (Groq/Cloud)");
                    TranscriberService.setCloudProvider(key);
                    SynthesizerService.setCloudProvider(key);
                }
            }
            // 2. Preload/Init TTS
            // If Cloud TTS is configured (via setCloudProvider above), init() will defer local model.
            SynthesizerService.init().catch(e => console.error("TTS Preload Failed", e));
        };
        setTimeout(preload, 1000);
    }, []);
    // Stop voice if component unmounts
    useEffect(() => {
        return () => { stop(); };
    }, []);
    // Visualizer Data
    const [volume, setVolume] = useState(0);
    useEffect(() => {
        if (!isVoiceActive)
            return;
        let rafId;
        const animate = () => {
            const analyser = getAnalyser();
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++)
                    sum += dataArray[i];
                setVolume(sum / dataArray.length);
            }
            rafId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(rafId);
    }, [isVoiceActive, getAnalyser]);
    const visualizerScale = 1 + (volume / 255) * 0.4 + (vadProb * 0.1);
    const visualizerColor = state === 'listening' ? 'var(--accent)' :
        state === 'processing' ? '#818cf8' :
            state === 'speaking' ? '#34d399' : '#a8a29e';
    return (_jsxs("form", { onSubmit: handleChat, className: styles.inputWrapper, style: { flexDirection: 'column', alignItems: 'stretch', position: 'relative' }, children: [isVoiceActive && (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: styles.voiceOverlayInline, style: {
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 20,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 8,
                    border: `1px solid ${visualizerColor}`
                }, children: [_jsx(motion.div, { animate: { scale: visualizerScale, backgroundColor: visualizerColor }, style: { width: 40, height: 40, borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }), _jsxs("div", { style: { fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }, children: [state === 'idle' && "Listening...", state === 'listening' && "Listening...", state === 'processing' && "Thinking...", state === 'speaking' && "Speaking..."] }), transcript && _jsxs("div", { style: { fontSize: '0.75rem', maxWidth: '80%', textAlign: 'center', opacity: 0.7 }, children: ["\"", transcript, "\""] }), _jsx("button", { type: "button", onClick: toggleVoice, style: { position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#666' }, children: _jsx(X, { size: 16 }) })] })), isDragOver && (_jsx("div", { style: {
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '2px dashed #3b82f6',
                    borderRadius: 8,
                    pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#3b82f6', fontWeight: 600,
                    zIndex: 10
                }, children: "Drop files here to attach" })), attachedFiles.length > 0 && (_jsx("div", { style: { width: '100%', padding: '0 0.5rem 0.5rem 0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.5rem' }, children: attachedFiles.map((f, i) => (_jsx("div", { style: { fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }, children: f.name }, i))) })), _jsxs("div", { style: { display: 'flex', width: '100%', alignItems: 'flex-end', gap: '0.5rem', flexDirection: 'column' }, children: [_jsx("div", { style: {
                            alignSelf: 'flex-start',
                            display: 'flex',
                            gap: '0.25rem',
                            padding: '2px',
                            background: 'var(--surface)',
                            borderRadius: 8,
                            marginBottom: 4,
                            border: '1px solid var(--border)'
                        }, children: ['chat', 'research'].filter(m => {
                            var _a;
                            // In Core, only show 'chat' and 'research' if the mode is active
                            // The list of available modes can be extended by the parent application via props
                            return ((_a = meechi.activeMemories) === null || _a === void 0 ? void 0 : _a.includes(m)) || m === 'chat';
                        }).map((m) => (_jsxs("button", { type: "button", onClick: () => meechi.setMode(m), style: {
                                background: meechi.mode === m ? 'var(--accent)' : 'transparent',
                                color: meechi.mode === m ? 'var(--background)' : 'var(--secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: 4
                            }, children: [_jsx(Icon, { name: m === 'chat' ? "MessageCircle" : "Search", size: 14 }), m.charAt(0).toUpperCase() + m.slice(1)] }, m))) }), _jsxs("div", { style: { display: 'flex', width: '100%', alignItems: 'flex-end', gap: '0.5rem' }, children: [_jsx("textarea", { ref: textareaRef, value: chatInput, onChange: (e) => setChatInput(e.target.value), placeholder: meechi.mode === 'log' ? "Write to your Ship's Log..." :
                                    meechi.mode === 'research' ? "Ask a grounded question (Strict RAG)..." :
                                        "Ask Meechi anything... (Creative)", onDragEnter: () => setIsDragOver(true), onDragLeave: () => setIsDragOver(false), onDragOver: (e) => { e.preventDefault(); setIsDragOver(true); }, onDrop: async (e) => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        const files = Array.from(e.dataTransfer.files);
                                        for (const file of files) {
                                            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_ ()]/g, '').replace(/\s+/g, ' ').trim();
                                            const path = `temp/${safeName}`;
                                            if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
                                                const text = await file.text();
                                                await storage.saveFile(path, text);
                                            }
                                            else {
                                                const buffer = await file.arrayBuffer();
                                                await storage.saveFile(path, buffer);
                                            }
                                            setAttachedFiles([...attachedFiles, { name: safeName, path }]);
                                        }
                                    }
                                }, onKeyDown: (e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleChat(e);
                                    }
                                }, className: styles.chatInput, rows: 1, style: { width: '100%' }, disabled: isVoiceActive }), _jsx("button", { type: "button", onClick: () => {
                                    var _a, _b;
                                    const hasVoiceMsg = ((_a = meechi.activeMemories) === null || _a === void 0 ? void 0 : _a.includes('groq-voice')) || ((_b = meechi.activeMemories) === null || _b === void 0 ? void 0 : _b.includes('local-voice'));
                                    if (hasVoiceMsg)
                                        toggleVoice();
                                }, style: {
                                    background: isVoiceActive ? 'var(--accent)' : 'transparent',
                                    color: isVoiceActive ? 'white' : 'var(--secondary)',
                                    border: 'none',
                                    cursor: (((_a = meechi.activeMemories) === null || _a === void 0 ? void 0 : _a.includes('groq-voice')) || ((_b = meechi.activeMemories) === null || _b === void 0 ? void 0 : _b.includes('local-voice'))) ? 'pointer' : 'default',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: isVoiceActive ? 1 : (((_c = meechi.activeMemories) === null || _c === void 0 ? void 0 : _c.includes('groq-voice')) || ((_d = meechi.activeMemories) === null || _d === void 0 ? void 0 : _d.includes('local-voice')) ? 0.6 : 0.4),
                                    transition: 'all 0.2s ease',
                                    pointerEvents: (((_e = meechi.activeMemories) === null || _e === void 0 ? void 0 : _e.includes('groq-voice')) || ((_f = meechi.activeMemories) === null || _f === void 0 ? void 0 : _f.includes('local-voice'))) ? 'auto' : 'none'
                                }, title: (((_g = meechi.activeMemories) === null || _g === void 0 ? void 0 : _g.includes('groq-voice')) || ((_h = meechi.activeMemories) === null || _h === void 0 ? void 0 : _h.includes('local-voice'))) ? "Toggle Voice Mode" : "Voice MCP not active", children: _jsx(Mic, { size: 20 }) }), (((_j = meechi.localAIStatus) === null || _j === void 0 ? void 0 : _j.includes('Generating')) || ((_k = meechi.localAIStatus) === null || _k === void 0 ? void 0 : _k.includes('Thinking')) || state === 'speaking' || isPlaying || (state === 'processing')) ? (_jsx("button", { type: "button", onClick: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isVoiceActive) {
                                        stopPlayback(); // Stop Audio
                                    }
                                    meechi.stop(); // Stop LLM
                                }, className: styles.sendBtn, style: {
                                    background: 'var(--destructive)', color: 'white'
                                }, children: _jsx(Square, { size: 16, fill: "currentColor" }) })) : (_jsx("button", { type: "submit", className: styles.sendBtn, style: { display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx(ArrowUp, { size: 20 }) }))] })] })] }));
}
