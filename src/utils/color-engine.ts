/**
 * color-engine.ts
 * Pure color-space conversion utilities (OKLCH → sRGB, CIE Lab → sRGB).
 * No external dependencies. Suitable for browser and Node environments.
 */

/** Gamma-correct a linear sRGB channel. */
function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Convert an sRGB channel value (0-255) to a two-digit lowercase hex string. */
function u8hex(n: number): string {
    return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
}

/**
 * Convert an `oklch(L C H)` CSS string to `#rrggbb`.
 * L accepts both "60%" (CSS source) and "0.6" (Chrome computed style).
 * H accepts an optional "deg" suffix.
 */
export function oklchStringToHex(raw: string): string {
    const inner = raw.replace(/^oklch\(\s*/i, '').replace(/\s*\)$/, '').split('/')[0].trim();
    const parts = inner.split(/\s+/);
    if (parts.length < 3) return '';

    const l = parts[0].endsWith('%') ? Number(parts[0]) / 100 : Number(parts[0]);
    const c = Number(parts[1]);
    const hDeg = Number(parts[2].replace(/deg$/i, ''));
    if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(hDeg)) return '';

    const hRad = (hDeg * Math.PI) / 180;
    const a = c * Math.cos(hRad);
    const b = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.291485548 * b;
    const lc = l_ ** 3, mc = m_ ** 3, sc = s_ ** 3;

    const rLin =  4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
    const gLin = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
    const bLin = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701  * sc;

    return `#${u8hex(linearToSrgb(rLin) * 255)}${u8hex(linearToSrgb(gLin) * 255)}${u8hex(linearToSrgb(bLin) * 255)}`;
}

/**
 * Convert a CIE `lab(L a b)` CSS string to `#rrggbb`.
 * Chrome serializes computed OKLCH values as `lab()` — this is what
 * `getComputedStyle` actually returns in many Chromium versions.
 * Pipeline: Lab → XYZ D50 → XYZ D65 (Bradford) → linear sRGB → gamma sRGB
 */
export function labStringToHex(raw: string): string {
    const inner = raw.replace(/^lab\(\s*/i, '').replace(/\s*\)$/, '').split('/')[0].trim();
    const parts = inner.split(/\s+/);
    if (parts.length < 3) return '';

    const L = parts[0].endsWith('%') ? Number(parts[0].slice(0, -1)) : Number(parts[0]);
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) return '';

    // Lab → XYZ (D50)
    const δ = 6 / 29;
    const finv = (t: number) => (t > δ ? t ** 3 : 3 * δ * δ * (t - 4 / 29));
    const fy = (L + 16) / 116;
    const x = finv(a / 500 + fy) * 0.96422; // D50 Xw
    const y = finv(fy);                       // D50 Yw = 1
    const z = finv(fy - b / 200) * 0.82521;  // D50 Zw

    // XYZ D50 → XYZ D65 (Bradford chromatic adaptation)
    const xd =  0.9555766 * x - 0.0230393 * y + 0.0631636 * z;
    const yd = -0.0282895 * x + 1.0099416 * y + 0.0210077 * z;
    const zd =  0.0122982 * x - 0.0204830 * y + 1.3299098 * z;

    // XYZ D65 → linear sRGB
    const rLin =  3.2404542 * xd - 1.5371385 * yd - 0.4985314 * zd;
    const gLin = -0.9692660 * xd + 1.8760108 * yd + 0.0415560 * zd;
    const bLin =  0.0556434 * xd - 0.2040259 * yd + 1.0572252 * zd;

    return `#${u8hex(linearToSrgb(rLin) * 255)}${u8hex(linearToSrgb(gLin) * 255)}${u8hex(linearToSrgb(bLin) * 255)}`;
}

/**
 * Parse any common CSS color string to `#rrggbb`.
 * Handles: `#rrggbb`, `#rgb`, `rgb()`, `rgba()`, `lab()`, `oklch()`, `color(srgb ...)`.
 * Returns `''` for unrecognised or transparent input.
 */
export function anyColorStringToHex(s: string): string {
    const t = s.trim();
    if (!t || t === 'transparent') return '';

    // #rrggbb or #rgb
    if (/^#[0-9a-f]{6}$/i.test(t)) return t.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(t)) {
        return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
    }

    // rgb(r, g, b) or rgb(r g b) — also handles rgba, ignoring alpha
    const rgbM = t.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
    if (rgbM) return `#${u8hex(Number(rgbM[1]))}${u8hex(Number(rgbM[2]))}${u8hex(Number(rgbM[3]))}`;

    // lab(...) — Chrome's actual serialization format for OKLCH computed values
    if (/^lab\(/i.test(t)) return labStringToHex(t);

    // oklch(...) — both CSS source format (60%) and Chrome computed (0.6)
    if (/^oklch\(/i.test(t)) return oklchStringToHex(t);

    // color(srgb r g b) — possible future Chrome serialization
    const p3M = t.match(/^color\(\s*(?:srgb|display-p3)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (p3M) return `#${u8hex(Number(p3M[1]) * 255)}${u8hex(Number(p3M[2]) * 255)}${u8hex(Number(p3M[3]) * 255)}`;

    return '';
}

/**
 * Resolve a CSS custom property (e.g. `'--accent'`) to a `#rrggbb` hex string.
 *
 * Two-stage strategy so neither stage is a single point of failure:
 *
 * **Stage 1 — DOM probe**:
 *   Appends a `visibility:hidden` element with `background-color:var(--token)`.
 *   The browser resolves the full `var()` chain; we parse whatever it returns.
 *
 * **Stage 2 — Manual chain walk (fallback)**:
 *   Reads `getPropertyValue()` text directly from `:root`, walks `var()` references
 *   iteratively, then parses the raw OKLCH/hex string with our own math.
 *   This is independent of browser color serialisation quirks.
 *
 * Returns `''` if the property cannot be resolved (e.g. during SSR).
 */
export function resolveTokenToHex(varName: string): string {
    if (typeof document === 'undefined') return '';

    // --- Stage 1: DOM probe ---
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:1px;height:1px';
    probe.style.backgroundColor = `var(${varName})`;
    document.documentElement.appendChild(probe);
    const computed = getComputedStyle(probe).backgroundColor;
    probe.remove();

    const probeHex = anyColorStringToHex(computed);
    // rgba(0,0,0,0) is transparent = unresolved var(); don't treat it as black
    const isTransparent = /^rgba?\(\s*0\s*[,\s]\s*0\s*[,\s]\s*0\s*[,\s]\s*0/.test(computed.trim());
    if (probeHex && !isTransparent) return probeHex;

    // --- Stage 2: manual var() chain walk on :root ---
    const rootStyle = getComputedStyle(document.documentElement);
    let value = rootStyle.getPropertyValue(varName).trim();

    for (let depth = 0; depth < 10; depth++) {
        if (!value) break;
        // If it's a var() reference, unwrap it
        const varRef = value.match(/^var\(\s*(--[\w-]+)\s*\)/);
        if (varRef) {
            value = rootStyle.getPropertyValue(varRef[1]).trim();
            continue;
        }
        // Otherwise it should be an actual color value
        const hex = anyColorStringToHex(value);
        if (hex) return hex;
        break;
    }

    return '';
}
