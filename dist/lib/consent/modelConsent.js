export class ModelConsentManager {
    constructor() {
        this.storageKey = 'meechi_model_consents';
    }
    readRaw() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch (e) {
            console.warn('[ModelConsentManager] Failed to read consents', e);
            return [];
        }
    }
    writeRaw(list) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(list));
        }
        catch (e) {
            console.warn('[ModelConsentManager] Failed to write consents', e);
        }
    }
    getConsents() {
        return this.readRaw();
    }
    hasConsent(modelId) {
        const list = this.readRaw();
        return list.some(r => r.modelId === modelId);
    }
    getConsent(modelId) {
        const list = this.readRaw();
        return list.find(r => r.modelId === modelId) || null;
    }
    setConsent(modelId, license, licenseVersion) {
        const list = this.readRaw().filter(r => r.modelId !== modelId);
        list.push({ modelId, license, licenseVersion, acceptedAt: Date.now() });
        this.writeRaw(list);
    }
    revokeConsent(modelId) {
        const list = this.readRaw().filter(r => r.modelId !== modelId);
        this.writeRaw(list);
    }
}
export const modelConsentManager = new ModelConsentManager();
