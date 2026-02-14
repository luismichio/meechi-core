import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './CalendarView.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
export default function CalendarView({ onClose }) {
    const [dates, setDates] = useState([]); // ["2025-12-27", ...]
    const [selectedDate, setSelectedDate] = useState(null);
    const [logContent, setLogContent] = useState("");
    const [loading, setLoading] = useState(false);
    // Grid State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    // Use Dexie/Local Storage directly (Offline First)
    useEffect(() => {
        async function loadDates() {
            // Query Dexie directly or use LocalStorageProvider
            // We look for files in "history/" folder.
            // Importing LocalStorageProvider here or using db directly?
            // Let's use db from '@/lib/storage/db' for speed/reactivity or check how FileExplorer does it.
            // Actually, importing LocalStorageProvider is cleaner.
            const { db } = await import('@/lib/storage/db');
            const files = await db.files.where('path').startsWith('history/').toArray();
            // Extract dates from "history/YYYY-MM-DD.md"
            const dateList = files
                .map(f => { var _a; return (_a = f.path.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('.md', ''); })
                .filter(Boolean);
            setDates(dateList);
        }
        loadDates();
    }, [currentMonth]); // Check updates when month changes? Or just once/polling?
    async function loadLog(date) {
        setSelectedDate(date);
        setLoading(true);
        try {
            const { db } = await import('@/lib/storage/db');
            const file = await db.files.get(`history/${date}.md`);
            setLogContent((file === null || file === void 0 ? void 0 : file.content) || "Empty log.");
        }
        catch (e) {
            setLogContent("Error loading log.");
        }
        finally {
            setLoading(false);
        }
    }
    // --- Grid Helpers ---
    function getDaysInMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        return { daysInMonth, firstDay };
    }
    function changeMonth(delta) {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    }
    const { daysInMonth, firstDay } = getDaysInMonth(currentMonth);
    const gridCells = [];
    // Pad empty start cells
    for (let i = 0; i < firstDay; i++) {
        gridCells.push(_jsx("div", { className: styles.emptyCell }, `empty-${i}`));
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasLog = dates.includes(dateStr);
        const isSelected = selectedDate === dateStr;
        gridCells.push(_jsxs("button", { className: `${styles.dayCell} ${hasLog ? styles.hasLog : ''} ${isSelected ? styles.selected : ''}`, onClick: () => hasLog ? loadLog(dateStr) : null, disabled: !hasLog, children: [_jsx("span", { className: styles.dayNumber, children: d }), hasLog && _jsx("span", { className: styles.logIndicator })] }, d));
    }
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.header, children: [_jsx("h2", { children: "Your Journey Map" }), _jsx("button", { onClick: onClose, className: styles.closeBtn, children: "Close" })] }), _jsxs("div", { className: styles.content, children: [_jsxs("div", { className: styles.calendarPanel, children: [_jsxs("div", { className: styles.monthNav, children: [_jsx("button", { onClick: () => changeMonth(-1), style: { background: 'none', border: 'none', cursor: 'pointer' }, children: _jsx(ChevronLeft, {}) }), _jsx("h3", { children: currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' }) }), _jsx("button", { onClick: () => changeMonth(1), style: { background: 'none', border: 'none', cursor: 'pointer' }, children: _jsx(ChevronRight, {}) })] }), _jsxs("div", { className: styles.gridHeader, children: [_jsx("span", { children: "Sun" }), _jsx("span", { children: "Mon" }), _jsx("span", { children: "Tue" }), _jsx("span", { children: "Wed" }), _jsx("span", { children: "Thu" }), _jsx("span", { children: "Fri" }), _jsx("span", { children: "Sat" })] }), _jsx("div", { className: styles.grid, children: gridCells })] }), _jsx("div", { className: styles.logViewer, children: selectedDate ? (_jsxs(_Fragment, { children: [_jsxs("h3", { children: ["Log: ", selectedDate] }), loading ? (_jsx("p", { children: "Loading memory..." })) : (_jsx("div", { className: styles.markdownContent, children: logContent.split('\n').map((line, i) => (_jsx("p", { children: line }, i))) }))] })) : (_jsx("div", { className: styles.placeholder, children: _jsx("p", { children: "Select a highlighted date to view its log." }) })) })] })] }));
}
