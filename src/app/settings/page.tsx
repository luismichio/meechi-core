'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { settingsManager } from '@/lib/settings';

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({});
    const [status, setStatus] = useState<string>('');

    // Load settings
    useEffect(() => {
        settingsManager.getConfig().then(s => setSettings(s));
    }, []);

    const save = async () => {
        await settingsManager.saveConfig(settings);
        setStatus('Saved! Reloading engine...');
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <main className="p-8 max-w-2xl mx-auto">
            <header className="mb-8 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Settings</h1>
                <Link href="/app" className="underline opacity-60">Back to Chat</Link>
            </header>

            <div className="space-y-6">
                {/* AI Provider Section */}
                <section className="p-4 border rounded-lg">
                    <h2 className="font-bold mb-4">AI Provider</h2>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                checked={settings.aiProvider === 'local'} 
                                onChange={() => setSettings({...settings, aiProvider: 'local'})}
                            />
                            Local (WebLLM - Runs in Browser)
                        </label>
                        <label className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                checked={settings.aiProvider === 'gemini'} 
                                onChange={() => setSettings({...settings, aiProvider: 'gemini'})}
                            />
                            Google Gemini
                        </label>
                        <label className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                checked={settings.aiProvider === 'groq'} 
                                onChange={() => setSettings({...settings, aiProvider: 'groq'})}
                            />
                            Groq
                        </label>
                    </div>
                </section>

                {/* API Keys */}
                {(settings.aiProvider === 'gemini' || settings.aiProvider === 'groq') && (
                    <section className="p-4 border rounded-lg">
                        <h2 className="font-bold mb-4">Credentials</h2>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm opacity-70">API Key</label>
                            <input 
                                type="password"
                                className="border p-2 rounded"
                                value={settings.apiKey || ''}
                                onChange={e => setSettings({...settings, apiKey: e.target.value})}
                                placeholder="sk-..."
                            />
                        </div>
                    </section>
                )}

                <button 
                    onClick={save}
                    className="px-6 py-2 bg-black text-white rounded hover:opacity-80 disabled:opacity-50"
                >
                    Save Changes
                </button>
                
                {status && <div className="text-sm text-green-600 font-bold">{status}</div>}
            </div>
        </main>
    );
}
