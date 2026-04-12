/**
 * color-engine.ts
 * Pure color-space conversion utilities (OKLCH → sRGB, CIE Lab → sRGB).
 * No external dependencies. Suitable for browser and Node environments.
 */
/**
 * Convert an `oklch(L C H)` CSS string to `#rrggbb`.
 * L accepts both "60%" (CSS source) and "0.6" (Chrome computed style).
 * H accepts an optional "deg" suffix.
 */
export declare function oklchStringToHex(raw: string): string;
/**
 * Convert a CIE `lab(L a b)` CSS string to `#rrggbb`.
 * Chrome serializes computed OKLCH values as `lab()` — this is what
 * `getComputedStyle` actually returns in many Chromium versions.
 * Pipeline: Lab → XYZ D50 → XYZ D65 (Bradford) → linear sRGB → gamma sRGB
 */
export declare function labStringToHex(raw: string): string;
/**
 * Parse any common CSS color string to `#rrggbb`.
 * Handles: `#rrggbb`, `#rgb`, `rgb()`, `rgba()`, `lab()`, `oklch()`, `color(srgb ...)`.
 * Returns `''` for unrecognised or transparent input.
 */
export declare function anyColorStringToHex(s: string): string;
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
export declare function resolveTokenToHex(varName: string): string;
