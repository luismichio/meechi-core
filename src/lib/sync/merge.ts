export function mergeLogs(local: string, remote: string): string {
    const localEntries = parseEntries(local);
    const remoteEntries = parseEntries(remote);

    // Merge map: Key = "Timestamp|ContentHash" -> Entry
    const merged = new Map<string, string>();

    // Add Remote first (Truth)
    remoteEntries.forEach(entry => {
        const key = generateKey(entry);
        merged.set(key, entry.fullText);
    });

    // Add Local (Append/Fill gaps)
    localEntries.forEach(entry => {
        const key = generateKey(entry);
        if (!merged.has(key)) {
            merged.set(key, entry.fullText);
        }
    });

    // Sort by Timestamp
    const sortedEntries = Array.from(merged.values()).sort((a, b) => {
        const timeA = extractDate(a);
        const timeB = extractDate(b);
        return timeA.getTime() - timeB.getTime();
    });

    return sortedEntries.join('\n\n');
}

// Helpers
function parseEntries(log: string) {
    if (!log) return [];
    return log.split('### ').filter(c => c.trim()).map(chunk => {
        // Re-add delimiter for reconstruction
        const fullText = '### ' + chunk.trim(); 
        const lines = chunk.split('\n');
        // Timestamp is the first line after ###
        const timestampStr = lines[0].trim(); 
        // We assume today's date for sorting relative to each other (since files are per day)
        // Ideally we'd parse the full date if available, but time string works for daily logs
        return {
            timestampStr,
            fullText
        };
    });
}

function generateKey(entry: { timestampStr: string, fullText: string }) {
    // Simple key: Time + First 20 chars of content (to distinguish different messages at same second)
    const contentSignature = entry.fullText.replace(/\s/g, '').slice(0, 50);
    return `${entry.timestampStr}|${contentSignature}`;
}

function extractDate(entryText: string) {
    // Extract "12:00:00 PM"
    const match = entryText.match(/### (.*?)(\n|$)/);
    if (!match) return new Date(0);
    const timeStr = match[1];
    
    // Parse Time String (assuming today context, but really we just need relative sort)
    // "12:00:00 PM" -> Date
    const d = new Date();
    const [time, period] = timeStr.split(' ');
    if (!time) return new Date(0);
    
    let [hours, minutes, seconds] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    d.setHours(hours || 0, minutes || 0, seconds || 0);
    return d;
}
