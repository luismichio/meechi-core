export interface ModelConsentRecord {
    modelId: string;
    license: string;
    licenseVersion?: string;
    acceptedAt: number;
}

export class ModelConsentManager {
    private storageKey = 'meechi_model_consents';

    private readRaw(): ModelConsentRecord[] {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as ModelConsentRecord[];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[ModelConsentManager] Failed to read consents', e);
            return [];
        }
    }

    private writeRaw(list: ModelConsentRecord[]) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(list));
        } catch (e) {
            console.warn('[ModelConsentManager] Failed to write consents', e);
        }
    }

    public getConsents(): ModelConsentRecord[] {
        return this.readRaw();
    }

    public hasConsent(modelId: string): boolean {
        const list = this.readRaw();
        return list.some(r => r.modelId === modelId);
    }

    public getConsent(modelId: string): ModelConsentRecord | null {
        const list = this.readRaw();
        return list.find(r => r.modelId === modelId) || null;
    }

    public setConsent(modelId: string, license: string, licenseVersion?: string) {
        const list = this.readRaw().filter(r => r.modelId !== modelId);
        list.push({ modelId, license, licenseVersion, acceptedAt: Date.now() });
        this.writeRaw(list);
    }

    public revokeConsent(modelId: string) {
        const list = this.readRaw().filter(r => r.modelId !== modelId);
        this.writeRaw(list);
    }
}

export const modelConsentManager = new ModelConsentManager();
