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
    storage: any;
}
export interface FileAction {
    id: string;
    label: string;
    icon?: LucideIcon;
    handler: (file: any, context: FileContext) => Promise<void>;
    shouldShow?: (file: any) => boolean;
}
declare class ExtensionRegistry {
    private settingsTabs;
    private fileActions;
    registerSettingsTab(tab: SettingsTab): void;
    getSettingsTabs(): SettingsTab[];
    registerFileAction(action: FileAction): void;
    getFileActions(): FileAction[];
}
export declare const extensions: ExtensionRegistry;
export {};
