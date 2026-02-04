'use client';
import { useState } from 'react';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import { LocalStorageProvider } from '@/lib/storage/local';

export default function AppPage() {
  // Initialize Storage at Page Level
  const [storage] = useState(() => new LocalStorageProvider());

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ 
            padding: '1rem', 
            borderBottom: '1px solid #eee', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <span style={{ fontWeight: 'bold' }}>Meechi / Core</span>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Link href="/settings" style={{ fontSize: '0.9rem', textDecoration: 'none', opacity: 0.7 }}>Settings</Link>
                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Local Mode</div>
            </div>
        </header>
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatInterface storage={storage} />
        </div>
    </main>
  );
}
