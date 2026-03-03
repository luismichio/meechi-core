'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { settingsManager } from '@/lib/settings';

// Lucide props usually include color, size, strokeWidth, absoluteStrokeWidth, etc.
// We extend SVGProps to allow standard SVG attributes like fill, opacity, etc.
interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: string; // Case-insensitive match attempt
    size?: number | string;
    className?: string;
    color?: string; // Explicitly defined in Lucide types often
}

export default function Icon({ name, size = 16, className, color, ...props }: IconProps) {
    const [library, setLibrary] = React.useState<'default' | 'bold' | 'thin'>('default');

    React.useEffect(() => {
        async function load() {
           const cfg = await settingsManager.getConfig();
           const lib = cfg.appearance?.iconLibrary as string | undefined;
           if (lib === 'default' || lib === 'bold' || lib === 'thin') {
               setLibrary(lib);
           } else {
               setLibrary('default');
           }
        }
        load(); 
    }, []);

    // Normalize Name (e.g. "search" -> "Search", "file-text" -> "FileText")
    // Lucide exports PascalCase.
    const pascalName = name.split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    
    const LucideIcon = (LucideIcons as any)[pascalName] || (LucideIcons as any)[name];
            
    if (!LucideIcon) {
        console.warn(`Icon not found: ${name} (${pascalName})`);
        return <span style={{ width: size, height: size, display: 'inline-block', background: '#ccc' }} />;
    }

    if (library === 'bold') {
        return <LucideIcon 
            size={size} 
            className={className} 
            color={color} 
            strokeWidth={2.8} 
            strokeLinejoin="round" 
            strokeLinecap="round"
            {...props} 
        />;
    }

    if (library === 'thin') {
        return <LucideIcon 
            size={size} 
            className={className} 
            color={color} 
            strokeWidth={0.75} 
            strokeLinejoin="round" 
            strokeLinecap="round"
            {...props} 
        />;
    }

    // Default Lucide
    return <LucideIcon size={size} className={className} color={color} {...props} />;
}
