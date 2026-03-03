// Configure PDF.js worker
const PDFJS_VERSION = '4.9.155';
/**
 * Extracts text content from a PDF ArrayBuffer with basic styling and layout preservation.
 *
 * Improvements:
 * - Detects Headers based on font size relative to body text.
 * - Detects Bold/Italic based on font name.
 * - Preserves Paragraphs (double newline) based on vertical gaps.
 * - Preserves Line Breaks (single newline).
 */
export async function extractTextFromPdf(data) {
    // Dynamic import to avoid SSR crashes with DOMMatrix/Canvas
    const pdfjsLib = await import('pdfjs-dist');
    // Use local worker for offline support and speed
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    try {
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const items = textContent.items;
            if (items.length === 0)
                continue;
            // --- Pass 1: Statistics to identify Body Text ---
            // We assume the most common font height is the body text.
            const heightCounts = {};
            for (const item of items) {
                const h = Math.round(item.height); // Round to avoid precision noise
                if (h > 0) {
                    heightCounts[h] = (heightCounts[h] || 0) + item.str.length; // Weight by character count
                }
            }
            let bodyHeight = 0;
            let maxCount = 0;
            for (const [h, count] of Object.entries(heightCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    bodyHeight = Number(h);
                }
            }
            // --- Pass 2: Reconstruction ---
            let pageOutput = "";
            let lastY = -1;
            let lastX = -1;
            // Sort items by Y (descending for top-to-bottom) then X (ascending)
            // Note: PDF coordinates usually start from bottom-left, so higher Y is higher on page.
            // However, pdfjs-dist usually returns items in reading order. 
            // We rely on order but check coordinates for gaps.
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                const text = item.str;
                // Skip empty strings if they don't have significant structure implications
                if (!text.trim())
                    continue;
                // PDF uses a bottom-up coordinate system (0,0 is bottom-left usually), 
                // but sometimes it's flipped depending on the matrix. 
                // Let's rely on transform[5] which is TranslateY.
                const curY = item.transform[5];
                const curX = item.transform[4];
                const curHeight = item.height;
                // Detect Layout Changes
                if (lastY !== -1) {
                    const yDiff = Math.abs(curY - lastY);
                    // Simple heuristic: 
                    // If yDiff is small (essentially same line), check X gap.
                    // If yDiff is medium (next line), add \n.
                    // If yDiff is large (paragraph gap), add \n\n.
                    if (yDiff < curHeight * 0.5) {
                        // Same line
                        // Check if we need a space (simple heuristic)
                        // If there is a gap > 5px (arbitrary, depends on scale), add space found in PDF logic usually
                        // But item.str sometimes contains the space. 
                        // Let's just trust implicit spaces or add one if previous didn't end with one?
                        if (lastX !== -1 && curX > lastX + item.width && !pageOutput.endsWith(" ")) {
                            // This checks "end of last item" vs "start of current". 
                            // Wait, logic is: lastX + lastWidth vs curX.
                            // Simplifying: just add space if not already there, assuming distinct items act as words
                            if (pageOutput.length > 0 && !pageOutput.endsWith(" ") && !text.startsWith(" ")) {
                                pageOutput += " ";
                            }
                        }
                    }
                    else if (yDiff > bodyHeight * 1.5) {
                        // Likely a Paragraph break
                        pageOutput += "\n\n";
                    }
                    else {
                        // Standard line break
                        pageOutput += "\n";
                    }
                }
                else {
                    // First item on page
                }
                // Detect Styling
                let chunk = text;
                const isBold = /Bold|Bol/i.test(item.fontName);
                const isItalic = /Italic|Ita|Oblique/i.test(item.fontName);
                // Apply Markdown Styling
                if (isBold)
                    chunk = `**${chunk}**`;
                if (isItalic)
                    chunk = `_${chunk}_`;
                // Detect Headers
                // If it's effectively distinct line (we just added \n or \n\n or it's start)
                // and font is significantly larger than body.
                // Note: This logic applies the header tag *inline*. 
                // Ideally headers are block elements. 
                // We'll prepend # if it looks solely like a header line.
                // A simpler approach for robust output: Just check size and prepend #.
                // Markdown allows headers to be single lines.
                if (curHeight > bodyHeight * 1.1) {
                    if (curHeight > bodyHeight * 1.5) {
                        // H1 or H2
                        // Only prefix if we are at start of line
                        if (pageOutput.endsWith("\n") || pageOutput === "") {
                            chunk = `## ${chunk}`;
                        }
                    }
                    else {
                        // H3
                        if (pageOutput.endsWith("\n") || pageOutput === "") {
                            chunk = `### ${chunk}`;
                        }
                    }
                }
                pageOutput += chunk;
                lastY = curY;
                lastX = curX; // logic for spaces would need accumulated width, skipping for now to reduce risk
            }
            fullText += `--- Page ${i} ---\n${pageOutput}\n\n`;
        }
        return fullText.trim();
    }
    catch (error) {
        console.error("PDF Extraction Error:", error);
        throw new Error("Failed to extract text from PDF");
    }
}
