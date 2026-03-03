/**
 * Extracts text content from a PDF ArrayBuffer with basic styling and layout preservation.
 *
 * Improvements:
 * - Detects Headers based on font size relative to body text.
 * - Detects Bold/Italic based on font name.
 * - Preserves Paragraphs (double newline) based on vertical gaps.
 * - Preserves Line Breaks (single newline).
 */
export declare function extractTextFromPdf(data: ArrayBuffer): Promise<string>;
