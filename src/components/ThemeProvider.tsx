"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { settingsManager } from "@/lib/settings";
import { getOklch } from "@/lib/colors";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  // Appearance Sync
  React.useEffect(() => {
    setMounted(true);
    
    async function loadAppearance() {
        // Load initial appearance settings
        const config = await settingsManager.getConfig();
        applyAppearance(config.appearance);
    }
    loadAppearance();

    // Listen to storage changes for multi-tab sync (and settings page updates)
    // Note: LocalStorageProvider doesn't emit storage events on same tab write unless specific hook used.
    // We can rely on a simpler polling or event listener if needed.
    // For now, let's assume valid reload or Settings Page will signal us?
    // In a real app, use a Context or Event Bus. 
    // Hack for immediate feedback from Settings Page:
    window.addEventListener('meechi-appearance-update', async () => {
         const config = await settingsManager.getConfig();
         applyAppearance(config.appearance);
    });

    return () => {
        window.removeEventListener('meechi-appearance-update', () => {});
    };

  }, []);

  // Legacy Defaults to Ignore (Migration Hack)
  const IGNORED_DEFAULTS = [
      '#F9F7F2', // Old Light Background
      '#FFFFFF', // Old Surface
      '#1A1C1A', // Old Foreground
      '#5C635C', // Old Secondary
      '#6B8E6B', // Old Accent (Maybe keep this one? No, let's reset it to be safe if it matches default)
  ];

  const applyAppearance = (appearance: any) => {
      if (!appearance) return;
      
      const root = document.documentElement;
      
      // Font Handling
      if (appearance.fontFamily && !IGNORED_DEFAULTS.includes(appearance.fontFamily)) {
          if (appearance.fontFamily.startsWith('http')) {
             // ...
          } else {
             if (appearance.fontFamily === 'Inter') {
                 root.style.setProperty('--font-sans', 'var(--font-inter)');
             } else if (appearance.fontFamily === 'Lora') {
                 root.style.setProperty('--font-sans', 'var(--font-lora)');
             } else {
                 root.style.setProperty('--font-sans', 'monospace');
             }
          }
      }

      // Accent Color (OKLCH Engine)
      if (appearance.accentColor && !IGNORED_DEFAULTS.includes(appearance.accentColor)) {
           const { l, c, h, cssValue } = getOklch(appearance.accentColor);
           root.style.setProperty('--accent', cssValue);
           // ... (rest of accent logic) ...
           root.style.setProperty('--destructive', `oklch(${l} ${c} 25)`);
      } else {
           // Reset if it was previously set and now is ignored/empty
           root.style.removeProperty('--accent');
           root.style.removeProperty('--destructive');
      }

      // Backgrounds & Surfaces
      // Helper to apply or clear
      const setOrClear = (prop: string, value: string) => {
          if (value && !IGNORED_DEFAULTS.includes(value)) {
              root.style.setProperty(prop, value);
          } else {
              root.style.removeProperty(prop);
          }
      };

      setOrClear('--background', appearance.backgroundColor);
      setOrClear('--surface', appearance.surfaceColor);
      setOrClear('--foreground', appearance.foregroundColor);
      setOrClear('--secondary', appearance.secondaryColor);
  };

  if (!mounted) {
      // Prevent hydration mismatch
      return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
