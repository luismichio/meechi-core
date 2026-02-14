class ExtensionRegistry {
    constructor() {
        this.settingsTabs = [];
        this.fileActions = [];
    }
    registerSettingsTab(tab) {
        if (!this.settingsTabs.find(t => t.id === tab.id)) {
            this.settingsTabs.push(tab);
        }
    }
    getSettingsTabs() {
        return [...this.settingsTabs];
    }
    // File Explorer Slots
    registerFileAction(action) {
        if (!this.fileActions.find(a => a.id === action.id)) {
            this.fileActions.push(action);
        }
    }
    getFileActions() {
        return [...this.fileActions];
    }
}
export const extensions = new ExtensionRegistry();
