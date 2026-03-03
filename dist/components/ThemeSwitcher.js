"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import Icon from "@/components/Icon";
import { useTheme } from "next-themes";
export function ThemeSwitcher() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return (_jsx("div", { className: "flex items-center gap-2 p-1 bg-surface/10 rounded-full border border-border backdrop-blur-sm opacity-0", children: _jsx("div", { className: "w-8 h-8" }) }));
    }
    return (_jsxs("div", { className: "flex items-center gap-2 p-1 bg-surface/10 rounded-full border border-border backdrop-blur-sm", children: [_jsx("button", { onClick: () => setTheme("light"), className: `p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-accent text-surface' : 'text-muted hover:text-accent'}`, title: "Light Mode", children: _jsx(Icon, { name: "Sun", size: 16 }) }), _jsx("button", { onClick: () => setTheme("system"), className: `p-1.5 rounded-full transition-colors ${theme === 'system' ? 'bg-accent text-surface' : 'text-muted hover:text-accent'}`, title: "System Mode", children: _jsx(Icon, { name: "Monitor", size: 16 }) }), _jsx("button", { onClick: () => setTheme("dark"), className: `p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-accent text-surface' : 'text-muted hover:text-accent'}`, title: "Dark Mode", children: _jsx(Icon, { name: "Moon", size: 16 }) })] }));
}
