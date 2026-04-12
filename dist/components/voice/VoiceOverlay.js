"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { X, Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceLoop } from "@/lib/hooks/use-voice-loop";
export function VoiceOverlay({ isOpen, onClose, sendMessage }) {
    const { start, stop, state, vadProb, transcript, getAnalyser } = useVoiceLoop(sendMessage);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0);
    // Animation Loop for Volume
    useEffect(() => {
        if (!isOpen)
            return;
        let rafId;
        const analyser = getAnalyser();
        const bufferLength = analyser ? analyser.frequencyBinCount : 0;
        const dataArray = new Uint8Array(bufferLength);
        const animate = () => {
            if (!analyser) {
                // Retry if analyser not ready (usually is after start())
                const retry = getAnalyser();
                if (retry) {
                    // recursive restart with ready analyser
                }
            }
            else {
                analyser.getByteFrequencyData(dataArray);
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / bufferLength;
                setVolume(avg); // 0-255
            }
            rafId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(rafId);
    }, [isOpen, state, getAnalyser]); // Re-run if state changes or analyser becomes available
    useEffect(() => {
        if (isOpen) {
            start();
        }
        else {
            stop();
        }
        return () => {
            stop();
        };
    }, [isOpen]);
    const toggleMute = () => {
        if (isMuted) {
            // Resume
            start();
            setIsMuted(false);
        }
        else {
            stop(); // Stop listening
            setIsMuted(true);
        }
    };
    // Visualizer scale based on Volume (0-255) + small VAD bump
    // Base scale 1.0, max ~1.5
    const visualizerScale = 1 + (volume / 255) * 0.6 + (vadProb * 0.1);
    const visualizerColor = state === 'listening' ? 'bg-sage-500' :
        state === 'processing' ? 'bg-indigo-300' :
            state === 'speaking' ? 'bg-emerald-400' : 'bg-stone-300';
    return (_jsx(AnimatePresence, { children: isOpen && (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 20 }, className: "fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper-100/95 backdrop-blur-xl", children: [_jsx("div", { className: "absolute top-6 right-6", children: _jsx("button", { onClick: onClose, className: "p-4 rounded-full bg-stone-200 text-stone-600 hover:bg-stone-300 transition-colors", children: _jsx(X, { size: 24 }) }) }), _jsxs("div", { className: "relative flex items-center justify-center w-64 h-64", children: [_jsx(motion.div, { animate: { scale: state === 'listening' ? [1, 1.2, 1] : 1 }, transition: { repeat: Infinity, duration: 2 }, className: `absolute inset-0 rounded-full opacity-20 ${visualizerColor}` }), _jsx(motion.div, { animate: { scale: visualizerScale }, className: `w-32 h-32 rounded-full shadow-2xl transition-colors duration-300 ${visualizerColor}` }), _jsxs("div", { className: "absolute -bottom-16 text-stone-500 font-serif text-lg tracking-wide", children: [state === 'idle' && "Listening...", state === 'listening' && "I'm listening...", state === 'processing' && "Thinking...", state === 'speaking' && "Speaking..."] })] }), _jsx("div", { className: "mt-24 h-24 px-8 text-center max-w-2xl", children: _jsx(AnimatePresence, { mode: "wait", children: transcript && (_jsxs(motion.p, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, className: "text-2xl font-serif text-stone-800 leading-relaxed", children: ["\"", transcript, "\""] }, transcript)) }) }), _jsx("div", { className: "absolute bottom-12 flex gap-8", children: _jsx("button", { onClick: toggleMute, className: `p-6 rounded-full transition-all duration-300 ${isMuted ? 'bg-red-100 text-red-600' : 'bg-white text-stone-800 shadow-lg'}`, children: isMuted ? _jsx(MicOff, { size: 32 }) : _jsx(Mic, { size: 32 }) }) })] })) }));
}
