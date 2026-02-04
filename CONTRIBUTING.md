# Contributing to Meechi Core 🌿

Thank you for your interest in Meechi Core! We are building a professional, neutral, and high-performance agentic engine for the local-first future.

## ⚖️ License & CLA
Meechi Core is licensed under **AGPLv3**. 
To protect the project's sustainability and our ability to offer a commercial version (Jiyū), all contributors must sign our **Contributor License Agreement (CLA)**.

1.  **CLA Assistant**: When you open a PR, a bot will guide you through the digital signature process.
2.  **Rights**: You retain copyright, but grant Meechi a perpetual license to include your code in both Open Source and Proprietary releases.

## 🛠️ Development Setup

### 1. Requirements
- Node.js 20+
- Yarn 4+ (Strictly enforced)

### 2. Installation
```bash
git clone https://github.com/luismichio/meechi-core.git
cd meechi-core
yarn install
```

### 3. Running Dev Server
```bash
yarn dev --webpack
```
> [!IMPORTANT]
> You must use the `--webpack` flag to ensure compatibility with our ONNX/Audio dependencies. Turbopack is currently not supported for audio features.

## 🧪 Testing Standards
Every tool or core logic change must include unit tests.
```bash
yarn test
```
We aim for **100% coverage** on critical modules (`embeddings.ts`, `McpServer.ts`).

## 🗺️ Contribution Areas
Check the [BACKLOG.md](../BACKLOG.md) for "Core" tagged tasks. We specifically welcome:
- New MCP tool servers.
- Performance optimizations for IndexedDB/Dexie.
- Localization of the "Wise Peer" system prompts.
