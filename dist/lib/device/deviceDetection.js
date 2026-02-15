/**
 * Minimal device detection for browser + basic heuristics.
 * Keep implementation small and safe for Server-Side Rendering.
 */
export async function detectDeviceCapabilities() {
    // Default conservative values
    const capabilities = {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        estimatedVRAMMB: undefined,
        isMetered: false
    };
    if (typeof navigator === 'undefined')
        return capabilities;
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua) && !/iPad/.test(ua);
    const isTablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
    const isDesktop = !isMobile && !isTablet;
    capabilities.isMobile = Boolean(isMobile);
    capabilities.isTablet = Boolean(isTablet);
    capabilities.isDesktop = Boolean(isDesktop);
    // Network detection (may be undefined in some browsers)
    try {
        const nav = navigator;
        if (nav.connection && typeof nav.connection.effectiveType === 'string') {
            const type = nav.connection.effectiveType || '';
            // effectiveType like '4g','3g','2g','slow-2g'
            capabilities.isMetered = /2g|3g|slow-2g/.test(type) || !!nav.connection.saveData || !!nav.connection.metered;
            // treat 'cellular' as metered too
            if (nav.connection.type === 'cellular')
                capabilities.isMetered = true;
        }
    }
    catch (e) {
        // ignore
    }
    // Heuristic: try to estimate VRAM by device memory API and userAgent
    try {
        const anyNav = navigator;
        if (anyNav.deviceMemory) {
            // deviceMemory is approximate RAM in GB
            const ramGB = Number(anyNav.deviceMemory) || undefined;
            if (ramGB) {
                // Rough mapping: lower RAM -> lower VRAM available
                capabilities.estimatedVRAMMB = Math.max(512, Math.round((ramGB / 8) * 8192));
            }
        }
    }
    catch (e) {
        // ignore
    }
    return capabilities;
}
/**
 * Pick recommended model id based on capabilities.
 * - Mobile -> Qwen2.5-0.5B
 * - Tablet -> Qwen2.5-1.5B
 * - Desktop -> Phi-3 Mini
 */
export function getRecommendedModel(cap) {
    if (cap.isMobile)
        return 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
    if (cap.isTablet)
        return 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
    return 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
}
export function shouldWarnBeforeDownload(modelSizeMB, cap) {
    if (!modelSizeMB)
        return false;
    // Always warn on metered connections
    if (cap.isMetered)
        return true;
    // Warn if mobile and large download
    if (cap.isMobile && modelSizeMB > 1500)
        return true;
    return false;
}
