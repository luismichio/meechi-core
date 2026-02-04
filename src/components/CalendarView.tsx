import { useState, useEffect } from 'react';
import styles from './CalendarView.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView({ onClose }: { onClose: () => void }) {
  const [dates, setDates] = useState<string[]>([]); // ["2025-12-27", ...]
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>("");
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
            .map(f => f.path.split('/').pop()?.replace('.md', ''))
            .filter(Boolean) as string[];
            
        setDates(dateList);
    }
    loadDates();
  }, [currentMonth]); // Check updates when month changes? Or just once/polling?

  async function loadLog(date: string) {
    setSelectedDate(date);
    setLoading(true);
    try {
      const { db } = await import('@/lib/storage/db');
      const file = await db.files.get(`history/${date}.md`);
      setLogContent((file?.content as string) || "Empty log.");
    } catch (e) {
      setLogContent("Error loading log.");
    } finally {
      setLoading(false);
    }
  }

  // --- Grid Helpers ---
  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    return { daysInMonth, firstDay };
  }

  function changeMonth(delta: number) {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const { daysInMonth, firstDay } = getDaysInMonth(currentMonth);
  const gridCells = [];
  
  // Pad empty start cells
  for (let i = 0; i < firstDay; i++) {
    gridCells.push(<div key={`empty-${i}`} className={styles.emptyCell} />);
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasLog = dates.includes(dateStr);
    const isSelected = selectedDate === dateStr;

    gridCells.push(
      <button 
        key={d} 
        className={`${styles.dayCell} ${hasLog ? styles.hasLog : ''} ${isSelected ? styles.selected : ''}`}
        onClick={() => hasLog ? loadLog(dateStr) : null}
        disabled={!hasLog}
      >
        <span className={styles.dayNumber}>{d}</span>
        {hasLog && <span className={styles.logIndicator} />}
      </button>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Your Journey Map</h2>
        <button onClick={onClose} className={styles.closeBtn}>Close</button>
      </div>

      <div className={styles.content}>
        <div className={styles.calendarPanel}>
            <div className={styles.monthNav}>
                <button onClick={() => changeMonth(-1)} style={{background:'none', border:'none', cursor:'pointer'}}><ChevronLeft /></button>
                <h3>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => changeMonth(1)} style={{background:'none', border:'none', cursor:'pointer'}}><ChevronRight /></button>
            </div>
            <div className={styles.gridHeader}>
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
            <div className={styles.grid}>
                {gridCells}
            </div>
        </div>

        <div className={styles.logViewer}>
            {selectedDate ? (
                <>
                    <h3>Log: {selectedDate}</h3>
                    {loading ? (
                        <p>Loading memory...</p>
                    ) : (
                        <div className={styles.markdownContent}>
                            {logContent.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className={styles.placeholder}>
                    <p>Select a highlighted date to view its log.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
