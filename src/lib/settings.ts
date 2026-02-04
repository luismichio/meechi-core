import { StorageProvider } from './storage/types';
import { LocalStorageProvider } from './storage/local';

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
    tone: string; // e.g. "Casual", "Formal", "Pirate"
}

export interface LocalAIConfig {
    enabled: boolean;
    model: string;
}

export interface AppearanceConfig {
    fontFamily: string; // e.g. "Inter", "Lora", "Mono", or custom URL
    accentColor: string; // Hex
    backgroundColor?: string;
    surfaceColor?: string;
    foregroundColor?: string;
    secondaryColor?: string;
    radius: string; // Tailwind/CSS value e.g. "0.5rem"
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
        primarySync: string; // 'local' | 'folder' | 'gdrive' | 'onedrive'
    };
    // Note: Desktop-specific config (like Ollama) is managed by the Meechi app, not Core.
}

const DEFAULT_CONFIG: AppConfig = {
    identity: {
        name: "Traveler",
        tone: "Casual, positive, and concise"
    },
    providers: [
        {
            id: 'groq',
            name: 'Groq',
            enabled: true,
            model: 'llama-3.3-70b-versatile'
        }
    ],
    activeProviderId: 'groq',
    localAI: {
        enabled: true,
        model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' // Default to 1B (Stable)
    },
    theme: 'system',
    appearance: {
        fontFamily: 'Lora',
        accentColor: '#6B8E6B', // Sage
        // Colors left undefined to allow CSS variables (Light/Dark mode) to take precedence.
        // User can still override them in settings.
        radius: '0.5rem',
        iconLibrary: 'lucide'
    },
    storage: {
        primarySync: 'local'
    }
};

const CONFIG_PATH = 'core/config.json';

export class SettingsManager {
    private storage: StorageProvider;

    constructor(storage: StorageProvider) {
        this.storage = storage;
    }

    async getConfig(): Promise<AppConfig> {
        try {
            const content = await this.storage.readFile(CONFIG_PATH);
            if (!content || typeof content !== 'string') {
                return DEFAULT_CONFIG;
            }
            const parsed = JSON.parse(content);
            // Merge with default to ensure new fields are present
            return { 
                ...DEFAULT_CONFIG, 
                ...parsed, 
                identity: { ...DEFAULT_CONFIG.identity, ...parsed.identity },
                localAI: { ...DEFAULT_CONFIG.localAI, ...parsed.localAI } 
            };
        } catch (e) {
            console.warn("Failed to load config, returning default", e);
            return DEFAULT_CONFIG;
        }
    }

    async saveConfig(config: AppConfig): Promise<void> {
        const content = JSON.stringify(config, null, 2);
        await this.storage.saveFile(CONFIG_PATH, content);
    }

    async updateIdentity(identity: Partial<UserIdentity>): Promise<void> {
        const config = await this.getConfig();
        config.identity = { ...config.identity, ...identity };
        await this.saveConfig(config);
    }
    
    async updateProvider(providerId: string, updates: Partial<AIProviderConfig>): Promise<void> {
        const config = await this.getConfig();
        const index = config.providers.findIndex(p => p.id === providerId);
        
        if (index >= 0) {
            config.providers[index] = { ...config.providers[index], ...updates };
        } else {
            // Add if not exists (allows adding generic/custom providers via this generic method if needed)
            // But usually we want strict registration. For now, let's just update if exists.
             console.warn(`Provider ${providerId} not found in config.`);
        }
        await this.saveConfig(config);
    }

    async setActiveProvider(providerId: string): Promise<void> {
        const config = await this.getConfig();
        // Verify it exists and is enabled?
        const provider = config.providers.find(p => p.id === providerId);
        if (provider) {
             config.activeProviderId = providerId;
             await this.saveConfig(config);
        }
    }
}

// Singleton helper for client-side usage if needed, 
// though usually we instantiate this with the specific storage instance.
export const settingsManager = new SettingsManager(new LocalStorageProvider());
