export interface DeviceCapabilities {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    estimatedVRAMMB?: number;
    isMetered: boolean;
}
/**
 * Minimal device detection for browser + basic heuristics.
 * Keep implementation small and safe for Server-Side Rendering.
 */
export declare function detectDeviceCapabilities(): Promise<DeviceCapabilities>;
/**
 * Pick recommended model id based on capabilities.
 * - Mobile -> Qwen2.5-0.5B
 * - Tablet -> Qwen2.5-1.5B
 * - Desktop -> Phi-3 Mini
 */
export declare function getRecommendedModel(cap: DeviceCapabilities): string;
export declare function shouldWarnBeforeDownload(modelSizeMB: number | undefined, cap: DeviceCapabilities): boolean;
