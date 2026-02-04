// MCP Core
export * from './lib/mcp/McpClient';
export * from './lib/mcp/McpRegistry';
export * from './lib/mcp/types';
export * from './lib/mcp/native';

// Storage & Sync
export * from './lib/storage/db';
export * from './lib/storage/local';
export * from './lib/yjs/store';
export * from './lib/yjs/syncGraph';

// AI Logic & Prompts
export * from './lib/ai/embeddings';
export * from './lib/ai/prompts';
export * from './lib/ai/registry'; // Needed?

// Hooks
export * from './hooks/useMeechi';

// Settings & Extensions
export * from './lib/settings';
export * from './lib/extensions';

// Note: UI Components (SourceEditor, FileExplorer, etc.) are excluded from the
// Core library build because they depend on application-specific CSS.
// Consumers should import these directly from their own app.
