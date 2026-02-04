
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { YjsProvider } from '@/lib/yjs/YjsProvider';

export const metadata: Metadata = {
  title: 'Meechi Core',
  description: 'The Open Source Cognitive Engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
           {/* Core Reference App operates in Guest Mode / Local Mode by default */}
           <YjsProvider>
               {children}
           </YjsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
