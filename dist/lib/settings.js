import { LocalStorageProvider } from './storage/local';
const DEFAULT_CONFIG = {
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
        },
        {
            id: 'llama_hub',
            name: 'Llama Hub',
            enabled: true,
            model: 'Llama-3.2-3B'
        }
    ],
    activeProviderId: 'local',
    localAI: {
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
    },
    theme: 'light',
    appearance: {
        fontFamily: 'Lora',
        accentColor: '', // Let globals.css dictate the CSS variable
        radius: '0.5rem',
        iconLibrary: 'default'
    },
    storage: {
        primarySync: 'local'
    },
    search: {
        searxngUrl: 'https://searx.be',
        readerMode: 'local'
    }
};
const CONFIG_PATH = 'core/config.json';
export class SettingsManager {
    constructor(storage) {
        this.storage = storage;
    }
    async getConfig() {
        try {
            const content = await this.storage.readFile(CONFIG_PATH);
            if (!content || typeof content !== 'string') {
                return DEFAULT_CONFIG;
            }
            const parsed = JSON.parse(content);
            // Merge with default to ensure new fields are present
            return Object.assign(Object.assign(Object.assign({}, DEFAULT_CONFIG), parsed), { identity: Object.assign(Object.assign({}, DEFAULT_CONFIG.identity), parsed.identity), localAI: Object.assign(Object.assign({}, DEFAULT_CONFIG.localAI), parsed.localAI), search: Object.assign(Object.assign({}, DEFAULT_CONFIG.search), parsed.search) });
        }
        catch (e) {
            console.warn("Failed to load config, returning default", e);
            return DEFAULT_CONFIG;
        }
    }
    async saveConfig(config) {
        const content = JSON.stringify(config, null, 2);
        await this.storage.saveFile(CONFIG_PATH, content);
    }
    async updateIdentity(identity) {
        const config = await this.getConfig();
        config.identity = Object.assign(Object.assign({}, config.identity), identity);
        await this.saveConfig(config);
    }
    async updateProvider(providerId, updates) {
        const config = await this.getConfig();
        const index = config.providers.findIndex(p => p.id === providerId);
        if (index >= 0) {
            config.providers[index] = Object.assign(Object.assign({}, config.providers[index]), updates);
        }
        else {
            // Add if not exists (allows adding generic/custom providers via this generic method if needed)
            // But usually we want strict registration. For now, let's just update if exists.
            console.warn(`Provider ${providerId} not found in config.`);
        }
        await this.saveConfig(config);
    }
    async setActiveProvider(providerId) {
        const config = await this.getConfig();
        // Verify it exists and is enabled?
        const provider = config.providers.find(p => p.id === providerId);
        if (provider) {
            config.activeProviderId = providerId;
            await this.saveConfig(config);
        }
    }
    async updateLocalAI(updates) {
        const config = await this.getConfig();
        config.localAI = Object.assign(Object.assign({}, config.localAI), updates);
        await this.saveConfig(config);
    }
}
// Singleton helper for client-side usage if needed, 
// though usually we instantiate this with the specific storage instance.
export const settingsManager = new SettingsManager(new LocalStorageProvider());
