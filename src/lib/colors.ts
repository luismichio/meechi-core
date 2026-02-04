
/**
 * Color Utilities for Meechi
 * Implements Hex -> OKLCH conversion for the dynamic theme engine.
 * 
 * Flow: Hex -> RGB -> Linear RGB -> OKLAB -> OKLCH
 */

// 1. Hex to sRGB (0-1)
function hexToRgb(hex: string): { r: number, g: number, b: number } {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    
    const bigint = parseInt(hex, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;

    return { r, g, b };
}

// 2. sRGB to Linear RGB
// sRGB transfer function removal
function linearize(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// 3. Linear RGB to OKLAB
// Approximate matrices from Okhwb/Okyz specifications
function rgbToOklab(rLin: number, gLin: number, bLin: number): { L: number, a: number, b: number } {
    const l = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
    const m = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
    const s = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    return { L, a, b };
}

// 4. OKLAB to OKLCH
function oklabToOklch(L: number, a: number, b: number): { l: number, c: number, h: number } {
    const C = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * (180 / Math.PI);
    
    if (h < 0) h += 360;

    return { l: L, c: C, h };
}

/**
 * Main function: Converts Hex to OKLCH string
 * Returns an object with the components for CSS variables
 */
export function getOklch(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    const rLin = linearize(r);
    const gLin = linearize(g);
    const bLin = linearize(b);
    
    const { L, a, b: bLab } = rgbToOklab(rLin, gLin, bLin);
    const { l, c, h } = oklabToOklch(L, a, bLab);

    // Format for CSS
    // Round for clean output
    const lStr = l.toFixed(3);
    const cStr = c.toFixed(3);
    const hStr = h.toFixed(2);

    return {
        l: lStr,
        c: cStr,
        h: hStr,
        cssValue: `oklch(${lStr} ${cStr} ${hStr})`
    };
}
