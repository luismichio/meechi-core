'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { localLlmService } from '../lib/ai/local-llm';
import { aiManager } from "../lib/ai/manager";
import { settingsManager, AppConfig } from '../lib/settings';
import { AIChatMessage } from '../lib/ai/types';
import { SYSTEM_PROMPT, RESEARCH_SYSTEM_PROMPT } from '../lib/ai/prompts';
import { mcpClient } from '../lib/mcp/McpClient';
import { AVAILABLE_MODELS } from '../lib/ai/registry';
import { parseToolCalls } from '../lib/ai/parsing';

export function useMeechi() {
    const [isLowPowerDevice, setIsLowPowerDevice] = useState(true);
    const [localAIStatus, setLocalAIStatus] = useState<string>("");
    const [downloadProgress, setDownloadProgress] = useState<{ percentage: number, text: string } | null>(null);
    const [loadedModel, setLoadedModel] = useState<string | null>(null);
    const [rateLimitCooldown, setRateLimitCooldown] = useState<number | null>(null);
    const [activeMemories, setActiveMemories] = useState<string[]>([]);
    const [mode, _setMode] = useState<string>('chat'); // Default to simple chat
    const [isReady, setIsReady] = useState(false);

    // Initialization Logic
    useEffect(() => {
        const init = async () => {
            const config = await settingsManager.getConfig();
            
            // Check Rate Limit Persisted
            const persisted = localStorage.getItem('meechi_rate_limit_cooldown');
            if (persisted) {
                 const ts = parseInt(persisted);
                 if (ts > Date.now()) setRateLimitCooldown(ts);
            }

            // Load Active Memories from Registry (Generic)
            const { mcpRegistry } = await import('../lib/mcp/McpClient');
            // Core allows ANY agent to be loaded, not just specific ones.
            const memories = mcpRegistry.getMarketplace()
                .filter(s => s.isActive)
                .map(s => s.id);
            setActiveMemories(memories);


            // Mode Persistence Logic
            const lastMode = localStorage.getItem('meechi_last_mode');
            if (lastMode && (memories.includes(lastMode) || lastMode === 'chat')) {
                _setMode(lastMode);
            } else {
                _setMode('chat'); // Default to Simple Chat
            }

            // CHECK CLOUD PRIORITY (Mirroring chat logic)
            // If activeProvider is Cloud and has Key, we skip auto-initializing Local 1B.
            // This prevents the "Waking up 1B..." status and saves huge resources.
             if (config.activeProviderId && config.activeProviderId !== 'local' && config.activeProviderId !== 'browser') {
                  const provider = config.providers.find(p => p.id === config.activeProviderId);
                  // Check Key in Config OR Environment
                  const hasKey = (provider?.apiKey && provider.apiKey.length > 0) || 
                                (config.activeProviderId === 'openai' && process.env.NEXT_PUBLIC_OPENAI_KEY_EXISTS) ||
                                (config.activeProviderId === 'groq' && process.env.NEXT_PUBLIC_GROQ_API_KEY); // Check env for Groq too if strict

                  if (hasKey) {
                      console.log(`[useMeechi] Cloud Configured (${config.activeProviderId}). Skipping Local Init.`);
                      setLocalAIStatus(`Cloud Ready (${config.activeProviderId})`);
                      setIsReady(true);
                      return; 
                  }
             }

             if (!config.localAI.enabled) return;

            // Hardware Detection
            try {
                let gpuInfo = {};
                if ('gpu' in navigator) {
                     const adapter = await (navigator as any).gpu.requestAdapter();
                     if (adapter) gpuInfo = await (adapter as any).requestAdapterInfo?.() || {};
                }
                
                // Heuristic: Apple or RTX 30/40 series -> High Power
                const isHighPower = (gpuInfo as any).vendor === 'apple' || 
                                    /RTX (3090|4080|4090|A6000)/i.test((gpuInfo as any).renderer || "");
                
                setIsLowPowerDevice(!isHighPower);
                
                // Model Selection Logic via Registry
                // Default: 1B for Low Power, 8B for High Power
                const defaultLow = AVAILABLE_MODELS.local.find(m => m.low_power && m.family === 'llama')!.id;
                // const defaultHigh = AVAILABLE_MODELS.find(m => !m.low_power && m.family === 'llama')!.id;
                
                let modelId = defaultLow; 
                const configModel = config.localAI.model;

                if (!configModel || configModel === 'Auto') {
                    // FORCE 1B Default (User Request: "Make the 1B the default")
                    // We ignore high power detection for stability.
                    modelId = defaultLow;
                } else {
                    // Check if the configModel exists in registry, otherwise fallback
                    const exists = AVAILABLE_MODELS.local.find(m => m.id === configModel);
                    modelId = exists ? exists.id : configModel;
                }
                
                setLoadedModel(modelId);

                // Initialize WebLLM
                const currentId = localLlmService.getModelId();
                const needsInit = !localLlmService.isInitialized() || (currentId !== modelId);

                if (needsInit) {
                    if (currentId && currentId !== modelId) {
                        const status = `Switching to ${modelId.includes('8B') ? '8B' : '1B'}...`;
                        setLocalAIStatus(status);
                        // Trigger blocking UI
                        setDownloadProgress({ percentage: 0, text: status });
                    } else {
                        const status = `Waking up ${modelId.includes('8B') ? '8B' : '1B'}...`;
                        setLocalAIStatus(status);
                        // Trigger blocking UI
                        setDownloadProgress({ percentage: 0, text: status });
                    }
                    
                    await localLlmService.initialize(modelId, (p) => {
                        if (p.includes("Fetching") || p.includes("Loading")) {
                            const match = p.match(/(\d+)%/);
                            if (match) {
                                setDownloadProgress({ percentage: parseInt(match[1]), text: p });
                                setLocalAIStatus(`Deep Thinking... (${match[1]}%)`);
                            }
                        }
                    });
                    setIsReady(true);
                    setLocalAIStatus("");
                    setDownloadProgress(null);
                } else {
                    // ALREADY INITIALIZED
                    console.log("[useMeechi] Local AI already initialized.");
                    setIsReady(true);
                    setLocalAIStatus(""); 
                }
            } catch (e) {
                console.error("Failed to init Local AI", e);
                setLocalAIStatus("Hibernating (Init Failed)");
            }

        };
        init();
    }, []);



    /**
     * UNIFIED CHAT FUNCTION
     * Handles Local -> Cloud fallback transparently.
     * Executes MCP tools automatically.
     */
    const chat = useCallback(async (
        userMsg: string,
        history: AIChatMessage[],
        context: string,
        onUpdate: (chunk: string) => void,
        onToolStart?: (toolName: string) => void,
        onToolResult?: (result: string) => void
    ) => {
        // 1. SIMPLE CHAT FALLBACK (Canvas / No Agents)
        // If the mode is 'chat' and the agent isn't active, we do a regular chat without persona.
        const isAgenticChat = activeMemories.includes(mode);
        const isSimpleChat = mode === 'chat';
        
        if (!isAgenticChat && !isSimpleChat) {
             // If trying to use an inactive agent, fallback to simple chat
             _setMode('chat');
        }

        const { mcpRegistry } = await import("../lib/mcp/McpClient");

        const config = await settingsManager.getConfig();
        // Determine if we should use Local AI or Cloud AI based on Active Provider
        // If activeProviderId is valid and NOT 'local' (and has a key?), prioritize it.
        // We assume 'local' or 'browser' means Local WebLLM.
        
        let useLocal = config.localAI.enabled; 
        
        if (config.activeProviderId && config.activeProviderId !== 'local' && config.activeProviderId !== 'browser') {
             // If user explicitly selected a Cloud Provider (e.g. Groq, OpenAI), 
             // we disable local usage for this turn.
             // But we should verify if the Cloud Provider is actually configured (Key exists?)
             const provider = config.providers.find(p => p.id === config.activeProviderId);
             const hasKey = provider?.apiKey || (config.activeProviderId === 'openai' && process.env.NEXT_PUBLIC_OPENAI_KEY_EXISTS);
             
             if (hasKey) {
                 useLocal = false; 
                 console.log(`[useMeechi] Using Cloud Provider: ${config.activeProviderId}`);
             } else {
                 console.warn(`[useMeechi] Cloud Provider ${config.activeProviderId} selected but NO KEY found. Falling back to Local.`);
             }
        }

        let finalContent = "";
        let userContentToUse = userMsg; // Default to raw user message

        // 2. PREPARE PERSONA BASED ON MODE & MEMORIES
        let modePrompt = SYSTEM_PROMPT;
        if (activeMemories.includes(mode)) {
            modePrompt = (await mcpRegistry.getAgentInstructions(mode)) || SYSTEM_PROMPT;
        }

        // Combine with background memories (if any agentic memories are active)
        const backgroundMemories = mcpRegistry.getCombinedInstructions();
        let systemMsg = `${modePrompt}\n\n### ACTIVE MEMORY BACKGROUND\n${backgroundMemories}`;

        let temp = mode === 'research' ? 0.3 : 0.7;

        if (mode === 'research') {
             // Truncate Context to prevent OOM
             const MAX_CONTEXT_CHARS = 5000;
             const contextStr = typeof context === 'string' ? context : String(context);
             const safeContext = contextStr.length > MAX_CONTEXT_CHARS 
                ? contextStr.substring(0, MAX_CONTEXT_CHARS) + "\n...(truncated)" 
                : contextStr;
             
             // NUKE CONTEXT CITATIONS
             const cleanContext = safeContext.replace(/[\(\[]\s*[A-Z][a-zA-Z\s&.]*,\s*\d{4}[a-z]?\s*[\)\]]/g, '');
            
             // CRITICAL FIX: Inject Context into the USER message for 1B focus.
             userContentToUse = `### CONTEXT (TRUSTED USER DATA - READ CAREFULLY)\n${cleanContext}\n\n### INSTRUCTION\nUsing the Trusted Data above, answer the user's question or summarize the content. The data is accurate. Do not refuse.\n\nIMPORTANT: Do NOT include a list of References or Sources at the end.\n\n### USER QUESTION\n${userMsg}`;
        } else {
            // CASUAL CHAT MODE
            const safeChatContext = context;

            if (safeChatContext && safeChatContext.length > 50) {
                  // Narrative Context Injection
                  const contextBlock = `
\n=== RELEVANT MEMORY & FILES ===
${safeChatContext}
===============================
(System Note: The above is context from your memory. Use it to answer the user naturally.)
`;
                  systemMsg += contextBlock;
            }
        }

        // 3. LOCAL AI ATTEMPT
        if (useLocal) {
            // Guard: If Local AI is enabled but not ready, stop.
            if (!isReady) {
                 // Check if actually initialized but state missed it (Race condition fix)
                 if (localLlmService.isInitialized()) {
                     console.log("[useMeechi] State desync detected. Setting Ready.");
                     setIsReady(true);
                 } else {
                     onUpdate("\n\n*Meechi is warming up... (Please wait for 'Ready' status)*");
                     return;
                 }
            }

            try {
                // Ensure initialized (Double check)
                if (!localLlmService.isInitialized()) {
                    await localLlmService.initialize(config.localAI.model);
                }

                // Filter out system tool reports so AI doesn't mimic them
                // This prevents the "hallucination" where AI just prints the result text
                // ALSO FILTER ERROR MESSAGES so AI doesn't repeat them
                // NEW: FILTER "REFUSALS". If the AI previously said "I don't have info", hide it so it doesn't repeat that pattern.
                const cleanHistory = history.map(m => {
                    // Sanitize 'Michio:' prefixes from old logs to prevent hallucination
                    let content = m.content;
                    if (m.role === 'assistant' || m.role === 'michio' as any) {
                         content = content.replace(/^(Michio|Meechi):\s*/i, '').trim();
                    }
                    return { role: m.role, content };
                }).filter(m => 
                    !m.content.startsWith('> **Tool') && 
                    !m.content.startsWith('**Error**') &&
                    !m.content.startsWith('Error:') &&
                    !m.content.includes("I don't have any information about your previous activities") &&
                    !m.content.includes("context to draw upon") &&
                    // Anti-Hallucination Filters (Log Style)
                    !m.content.includes("**Topic Summary**") &&
                    !m.content.includes("**Files and Topics**") &&
                    !m.content.includes("**Tools Used**") &&
                    !m.content.includes("**Summary of Recent Activity**")
                );

                const messages: AIChatMessage[] = [
                    { role: 'system', content: systemMsg },
                    ...cleanHistory,
                    { role: 'user', content: userContentToUse } 
                ];

                await localLlmService.chat(messages, (chunk) => {
                    finalContent += chunk;
                    onUpdate(chunk); 
                }, { 
                    temperature: temp,
                    // STOP TOKENS: Physically stop the model from generating references.
                    // We use the positive termination token "---END---" as the primary stop.
                    // We also include aggressive partial matches for References to catch them if the model ignores the end token.
                    stop: mode === 'research' ? [
                        "---END---", 
                        "Reference:", "References:", "Source:", "Sources:", "Bibliography:", 
                        "**Reference", "**Source", "### Reference", "### Source"
                    ] : undefined
                });
                
                // FINAL SANITIZATION BEFORE TOOLS/HISTORY
                finalContent = finalContent.replace(/^((Michio|Meechi|Echo|Assistant):\s*)+/i, '').trim();
                
                console.log(`[Raw AI Output (${mode})]:`, finalContent);

                // Post-Processing: Check for Tools (Using centralized parser)
                // Tools are technically allowed in both modes, but usually Research uses them more.
                const tools = parseToolCalls(finalContent);
                for (const tool of tools) {
                    if (onToolStart) onToolStart(tool.name);
                    
                    // CHECK FOR PARSE ERROR
                    if (tool.error) {
                         if (onToolResult) {
                            onToolResult(`\n> **Tool Error (${tool.name})**: Invalid JSON arguments. Please retry using strict JSON.`);
                        }
                        continue;
                    }

                    // EXECUTE VIA MCP SERVER
                    try {
                        const result = await mcpClient.executeTool(tool.name, tool.args);
                        
                        // Add result to LOCAL history for the follow-up generation
                        const resStr = `\n> **Tool (${tool.name})**: ${result.summary || result.message || JSON.stringify(result)}`;
                        messages.push({ role: 'user', content: resStr });
    
                        if (onToolResult) {
                            onToolResult(resStr);
                        }
                    } catch (toolErr: any) {
                        console.warn(`[Meechi] Tool Execution Failed: ${tool.name}`, toolErr);
                        const errStr = `\n> **Tool Error**: Failed to execute '${tool.name}'. Reason: ${toolErr.message || "Unknown error"}`;
                        messages.push({ role: 'user', content: errStr });
                        if (onToolResult) onToolResult(errStr);
                    }
                }

                // RECURSIVE FOLLOW-UP: Generate confirmation message ONLY if tools were used
                if (tools.length > 0) {
                    // Re-assemble messages for follow-up
                    const followUpMessages: AIChatMessage[] = [
                        ...messages.slice(0, messages.length - tools.length), // Original context (System + History + User)
                        { role: 'assistant', content: finalContent }, // The tool call it just made
                        ...messages.slice(messages.length - tools.length) // The tool results we pushed in the loop
                    ];

                    await localLlmService.chat(followUpMessages, (chunk) => {
                        // This will OVERWRITE the <function> output in the UI, which is exactly what we want
                        // (hiding the tool call implementation detail)
                        onUpdate(chunk); 
                    }, { temperature: temp });
                }
                
                return; // Success, exit.

            } catch (e: any) {
                console.warn("Local AI Failed.", e);
                
                // CRITICAL FAIL-SAFE:
                const activeId = config.activeProviderId || 'groq';
                const activeProvider = config.providers.find(p => p.id === activeId);
                
                // Strict check: Ensure apiKey is a non-empty string
                const rawKey = activeProvider?.apiKey;
                const hasCloudKey = (rawKey && rawKey.trim().length > 0) || (activeId === 'openai' && !!process.env.NEXT_PUBLIC_OPENAI_KEY_EXISTS); 

                const errorMessage = e?.message || "Unknown error";
                console.log("[Meechi Fallback Debug]", { 
                    error: errorMessage, 
                    activeId, 
                    hasCloudKey, 
                    rawKeyLength: rawKey?.length 
                });

                // If it was a GPU Crash, handle it specifically
                if (errorMessage === 'GPU_CRASH' || errorMessage.includes('Device was lost') || errorMessage.includes('ContextWindowSizeExceededError')) {
                    if (errorMessage.includes('ContextWindowSizeExceededError')) {
                         onUpdate(`\n\n**System Alert**: Context too large for this model (Try clearing chat or shorter docs).`);
                         return;
                    }
                    setLocalAIStatus("GPU Crashed (Reload Required)");
                    onUpdate(`\n\n**System Alert**: Local AI GPU Driver Crashed.\n- Please reload to reset.`);
                    return; // STOP. Do not fallback.
                }

                // If regular error but NO Cloud Key, STOP.
                if (!hasCloudKey) {
                    setLocalAIStatus("Error (No Cloud Fallback)");
                    onUpdate(`\n\n**Error**: Local AI failed. Cloud fallback skipped (No Key).\n\n**Reason**: ${e.message}`);
                    return; // STOP.
                }
                
                // Otherwise, fall through to Cloud
                console.log("Attempting Cloud Fallback (Key Found)...");
            }
        }

        // 2. CLOUD AI ATTEMPT
        try {
            if (rateLimitCooldown && Date.now() < rateLimitCooldown) {
                throw new Error(`Rate limit active until ${new Date(rateLimitCooldown).toLocaleTimeString()}`);
            }

            // STATIC DESKTOP MODE: Direct Client-Side Call
            const isStatic = process.env.NEXT_PUBLIC_IS_STATIC === 'true';
            
            if (isStatic) {
                console.log("[Meechi] Static Mode: Calling AI Client-Side...");
                const result = await aiManager.chat(
                   userMsg,
                   systemMsg, // Context is already embedded in system/user msg by now
                   history,
                   config,
                   [] // Tools (TODO: Support client-side tools if needed)
                );
                
                // Emulate Stream (roughly) or just dump content
                // AIManager returns full completion currently, not stream.
                // We'll just dump it all at once for now or chunk it?
                // The UI expects incremental updates if possible, but one big update is fine.
                onUpdate(result.content);
                return;
            }

            // WEB/PWA MODE: Server API Call
            const { mcpClient } = await import("../lib/mcp/McpClient");
            const dynamicTools = await mcpClient.getTools();

            const res = await fetch("/api/chat", {
                method: "POST",
                body: JSON.stringify({
                    message: userMsg,
                    history,
                    context,
                    config,
                    tools: dynamicTools // Explicitly pass the resolved tools
                }),
                headers: { "Content-Type": "application/json" }
            });

            if (!res.ok) {
                const errText = await res.text();
                // Check if it's the known rate limit
                if (res.status === 429) {
                    const retryAfter = 60 * 1000; // Default 1m
                    const cooldown = Date.now() + retryAfter;
                    setRateLimitCooldown(cooldown);
                    localStorage.setItem('meechi_rate_limit_cooldown', cooldown.toString());
                }
                
                // Parse if JSON
                let errMsg = errText;
                try {
                    const json = JSON.parse(errText);
                    if (json.message) errMsg = json.message;
                } catch {
                    // If it's HTML, it's likely a 500/404 page dump
                    if (errText.trim().startsWith("<!DOCTYPE html") || errText.includes("<html")) {
                        errMsg = "Server Error (HTML Response - Check Logs)";
                    }
                }

                console.error("[useMeechi] Server Error Details:", errMsg);
                throw new Error(`Server Error (${res.status}): ${errMsg.length > 500 ? errMsg.substring(0, 500) + "..." : errMsg}`);
            }

            const data = await res.json();
            
            // If Text Response
            if (data.response) {
                onUpdate(data.response);
            }

            // If Tool Calls (Cloud Format)
            if (data.tool_calls) {
                for (const call of data.tool_calls) {
                    const name = call.function.name;
                    const args = JSON.parse(call.function.arguments);
                    
                    if (onToolStart) onToolStart(name);
                    
                    // EXECUTE VIA MCP SERVER
                    const result = await mcpClient.executeTool(name, args);
                    
                    if (onToolResult) {
                        const resStr = `\n> **Tool (${name})**: ${result.summary || result.message || JSON.stringify(result)}`;
                        onToolResult(resStr);
                    }
                }
            }

        } catch (e: any) {
            // Handle GPU Crash specifically
            if (e.message === 'GPU_CRASH' || e.message.includes('Device was lost')) {
                setLocalAIStatus("GPU Crashed (Reloading...)");
                // Optional: Auto-switch to lighter model? 
                // For now, just let the user know they need to reload or it will retry next time.
                onUpdate(`\n\n**System Alert**: The GPU driver crashed. Please refresh the page to restore AI functionality.`);
            } else {
                onUpdate(`\n\n**Error**: ${e.message}`);
            }
        }

    }, [rateLimitCooldown, mode, isLowPowerDevice, loadedModel]);

    return {
        isReady,
        localAIStatus,
        downloadProgress,
        chat,
        isLowPowerDevice,
        loadedModel,
        activeMemories,
        mode,
        setMode: (m: string) => {
            _setMode(m);
            localStorage.setItem('meechi_last_mode', m);
        },
        stop: async () => {
            console.log("[Meechi] User requested STOP.");
            await localLlmService.interrupt();
        }
    };
}
