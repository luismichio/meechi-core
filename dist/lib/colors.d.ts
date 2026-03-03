/**
 * Color Utilities for Meechi
 * Implements Hex -> OKLCH conversion for the dynamic theme engine.
 *
 * Flow: Hex -> RGB -> Linear RGB -> OKLAB -> OKLCH
 */
/**
 * Main function: Converts Hex to OKLCH string
 * Returns an object with the components for CSS variables
 */
export declare function getOklch(hex: string): {
    l: string;
    c: string;
    h: string;
    cssValue: string;
};
