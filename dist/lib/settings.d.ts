import { StorageProvider } from './storage/types';
export interface AIProviderConfig {
    id: string;
    name: string;
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}
export interface UserIdentity {
    name: string;
    tone: string;
}
export interface LocalAIConfig {
    enabled: boolean;
    model: string;
}
export interface AppearanceConfig {
    fontFamily: string;
    accentColor: string;
    backgroundColor?: string;
    surfaceColor?: string;
    foregroundColor?: string;
    secondaryColor?: string;
    radius: string;
    iconLibrary: 'lucide' | 'material' | 'custom';
}
export interface AppConfig {
    identity: UserIdentity;
    providers: AIProviderConfig[];
    activeProviderId: string;
    localAI: LocalAIConfig;
    theme: 'light' | 'dark' | 'system';
    appearance: AppearanceConfig;
    storage: {
        primarySync: string;
    };
}
export declare class SettingsManager {
    private storage;
    constructor(storage: StorageProvider);
    getConfig(): Promise<AppConfig>;
    saveConfig(config: AppConfig): Promise<void>;
    updateIdentity(identity: Partial<UserIdentity>): Promise<void>;
    updateProvider(providerId: string, updates: Partial<AIProviderConfig>): Promise<void>;
    setActiveProvider(providerId: string): Promise<void>;
}
export declare const settingsManager: SettingsManager;
