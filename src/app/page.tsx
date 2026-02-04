
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        gap: '2rem' 
    }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Meechi Core</h1>
      <p style={{ maxWidth: 600, textAlign: 'center', lineHeight: 1.6, opacity: 0.8 }}>
          This is the reference implementation of the Meechi Protocol. 
          It runs locally, ensures your privacy, and provides the raw cognitive engine without the commercial layer.
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/app" style={{ 
              padding: '0.8rem 2rem', 
              background: '#000', 
              color: '#fff', 
              borderRadius: '0.5rem', 
              textDecoration: 'none' 
          }}>
              Launch App
          </Link>
          <a href="/documentation" style={{ 
              padding: '0.8rem 2rem', 
              border: '1px solid #ccc', 
              borderRadius: '0.5rem', 
              textDecoration: 'none' 
          }}>
              Documentation
          </a>
      </div>
    </main>
  );
}
