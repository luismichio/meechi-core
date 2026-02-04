# @meechi-ai/core

[![npm version](https://img.shields.io/npm/v/@meechi-ai/core.svg)](https://www.npmjs.com/package/@meechi-ai/core)
[![license](https://img.shields.io/npm/l/@meechi-ai/core.svg)](https://github.com/luismichio/meechi-core/blob/master/LICENSE)


The foundational AI & MCP engine for local-first applications.  
This library powers the **Meechi** application, providing the core orchestration layer for Local LLMs, Model Context Protocol (MCP) servers, and Offline-First synchronization.

## Features

- **Local LLM Orchestration**: Abstracted hook (`useMeechi`) for interacting with local models via WebLLM (WASM).
- **MCP Server Protocol**: A full TypeScript implementation of the Model Context Protocol for connecting tools and agents.
- **Offline-First Storage**: Built-in wrappers for `IndexedDB` (via Dexie) and CRDT sync (via Yjs).
- **Hardware Detection**: Utilities for detecting GPU capabilities and selecting appropriate quantized models.

## Installation

```bash
npm install @meechi/core
# or
yarn add @meechi/core
```

## Usage

### Basic AI Hook

```typescript
import { useMeechi } from '@meechi/core';

function App() {
  const { chat, isReady, localAIStatus } = useMeechi();

  const handleSend = async (msg) => {
    await chat(msg, history, context, (chunk) => {
      console.log("Stream:", chunk);
    });
  };

  if (!isReady) return <div>{localAIStatus}</div>;

  return <button onClick={() => handleSend("Hello!")}>Chat</button>;
}
```

### MCP Server Registration

```typescript
import { mcpRegistry, McpServer } from '@meechi/core';

// Register a custom tool
mcpRegistry.registerTool({
  name: "calculator",
  description: "Perform math",
  handler: async (args) => { return args.a + args.b; }
});
```

## License

This library is available under the **AGPLv3 License**.

