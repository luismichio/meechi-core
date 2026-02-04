import { LucideIcon } from 'lucide-react';
import React from 'react';

/**
 * MEECHI EXTENSION SYSTEM (Core)
 * ----------------------------
 * This file provides the generic slots for the application.
 * In Core, these registries are empty.
 * Parent applications can populate these registries at runtime/init.
 */

export interface SettingsTab {
    id: string;
    label: string;
    icon: LucideIcon;
    component: React.ComponentType;
}

export interface FileContext {
    storage: any; // Context injected by the explorer
}

export interface FileAction {
    id: string;
    label: string;
    icon?: LucideIcon;
    handler: (file: any, context: FileContext) => Promise<void>;
    shouldShow?: (file: any) => boolean;
}

class ExtensionRegistry {
    private settingsTabs: SettingsTab[] = [];
    private fileActions: FileAction[] = [];

    registerSettingsTab(tab: SettingsTab) {
        if (!this.settingsTabs.find(t => t.id === tab.id)) {
            this.settingsTabs.push(tab);
        }
    }

    getSettingsTabs(): SettingsTab[] {
        return [...this.settingsTabs];
    }

    // File Explorer Slots
    registerFileAction(action: FileAction) {
        if (!this.fileActions.find(a => a.id === action.id)) {
            this.fileActions.push(action);
        }
    }

    getFileActions(): FileAction[] {
        return [...this.fileActions];
    }
}

export const extensions = new ExtensionRegistry();
