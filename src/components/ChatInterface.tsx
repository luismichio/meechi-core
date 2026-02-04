'use client';
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import styles from './ChatInterface.module.css'; // We will create this or inline styles
import Icon from './Icon';
import { useMeechi } from '@/hooks/useMeechi';
import { StorageProvider } from '@/lib/storage/types';
import { AIChatMessage } from '@/lib/ai/types';

interface ChatInterfaceProps {
    storage: StorageProvider;
}

export default function ChatInterface({ storage }: ChatInterfaceProps) {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{
      role: 'user' | 'meechi', 
      content: string, 
      timestamp?: string
  }[]>([]);
  
  const [isChatting, setIsChatting] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meechi = useMeechi();

  // Load Initial History (Simplified for Reference App)
  useEffect(() => {
      // In a real app we would load from storage.
      // For reference app, we start fresh or show Welcome.
      if (messages.length === 0) {
           setMessages([{
               role: 'meechi',
               content: "Welcome to Meechi Core. I am your private AI assistant.",
               timestamp: new Date().toLocaleTimeString()
           }]);
      }
  }, []);

  // Auto-scroll
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatting]);

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput("");
    
    // 1. Add User Message
    setMessages(prev => [...prev, { 
        role: 'user', 
        content: text, 
        timestamp: new Date().toLocaleTimeString()
    }]);
    
    setIsChatting(true);

    // 2. Add Placeholder
    setMessages(prev => [...prev, { 
        role: 'meechi', 
        content: "...", 
        timestamp: new Date().toLocaleTimeString() 
    }]);

    // 3. Call AI
    const historyForAI = messages.map(m => ({
        role: m.role === 'meechi' ? 'assistant' : 'user',
        content: m.content
    } as AIChatMessage));

    let currentContent = "";
    
    await meechi.chat(
        text,
        historyForAI,
        "", // No Context RAG in basic reference app
        (chunk) => {
             currentContent += chunk;
             
             // Update UI
             setMessages(prev => {
                const newArr = [...prev];
                const lastIdx = newArr.length - 1;
                if (newArr[lastIdx] && newArr[lastIdx].role === 'meechi') {
                     newArr[lastIdx] = { ...newArr[lastIdx], content: currentContent };
                }
                return newArr;
             });
        }
    );
    
    setIsChatting(false);
    
    // 4. Save to Storage (Basic Log)
    // We demonstrate that storage works, but simplified format.
    const dateStr = new Date().toISOString().split('T')[0];
    const logEntry = `### ${new Date().toLocaleTimeString()}\n**User**: ${text}\n**Meechi**: ${currentContent}\n\n`;
    await storage.appendFile(`history/${dateStr}.md`, logEntry);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 800, margin: '0 auto' }}>
        
        {/* Chat Stream */}
        <div 
            ref={streamRef}
            style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
            {messages.map((m, i) => (
                <div key={i} style={{ 
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: m.role === 'user' ? '#e5e7eb' : 'transparent',
                    padding: m.role === 'user' ? '0.5rem 1rem' : '0',
                    borderRadius: '1rem',
                    borderBottomRightRadius: m.role === 'user' ? 0 : '1rem',
                }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: 4 }}>
                        {m.role === 'meechi' ? 'Meechi' : 'You'} • {m.timestamp}
                    </div>
                    <div style={{ lineHeight: 1.5 }}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '1rem', background: 'var(--background)' }}>
             <form onSubmit={handleChat} style={{ position: 'relative' }}>
                <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChat(e);
                        }
                    }}
                    placeholder="Type a message..."
                    style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #ccc',
                        resize: 'none',
                        minHeight: 50
                    }}
                />
                <button 
                    type="submit" 
                    disabled={isChatting || !chatInput.trim()}
                    style={{
                        position: 'absolute',
                        right: '1.5rem',
                        bottom: '1.5rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: isChatting ? 0.3 : 1
                    }}
                >
                    <Icon name="Send" size={20} />
                </button>
             </form>
             <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                 {meechi.localAIStatus || "Ready"}
             </div>
        </div>
    </div>
  );
}
