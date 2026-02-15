export interface ModelConsentRecord {
    modelId: string;
    license: string;
    licenseVersion?: string;
    acceptedAt: number;
}
export declare class ModelConsentManager {
    private storageKey;
    private readRaw;
    private writeRaw;
    getConsents(): ModelConsentRecord[];
    hasConsent(modelId: string): boolean;
    getConsent(modelId: string): ModelConsentRecord | null;
    setConsent(modelId: string, license: string, licenseVersion?: string): void;
    revokeConsent(modelId: string): void;
}
export declare const modelConsentManager: ModelConsentManager;
