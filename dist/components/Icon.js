'use client';
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { settingsManager } from '@/lib/settings';
export default function Icon(_a) {
    var { name, size = 16, className, color } = _a, props = __rest(_a, ["name", "size", "className", "color"]);
    const [library, setLibrary] = React.useState('lucide');
    React.useEffect(() => {
        async function load() {
            var _a;
            const cfg = await settingsManager.getConfig();
            setLibrary(((_a = cfg.appearance) === null || _a === void 0 ? void 0 : _a.iconLibrary) || 'lucide');
        }
        // load(); 
    }, []);
    // Normalize Name (e.g. "search" -> "Search", "file-text" -> "FileText")
    // Lucide exports PascalCase.
    const pascalName = name.split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    if (library === 'lucide') {
        const LucideIcon = LucideIcons[pascalName] || LucideIcons[name];
        if (!LucideIcon) {
            console.warn(`Icon not found: ${name} (${pascalName})`);
            return _jsx("span", { style: { width: size, height: size, display: 'inline-block', background: '#ccc' } });
        }
        // LucideIcon accepts LucideProps which are compatible with SVGProps
        return _jsx(LucideIcon, Object.assign({ size: size, className: className, color: color }, props));
    }
    if (library === 'material') {
        return _jsxs("span", { children: ["M-", name] }); // Placeholder
    }
    return null;
}
