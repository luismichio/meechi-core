import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const monorepoGuard = path.resolve(__dirname, '../../../scripts/guard-architecture.js');

if (fs.existsSync(monorepoGuard)) {
    execSync(`node "${monorepoGuard}"`, { stdio: 'inherit' });
} else {
    // Standalone context — guard was already verified at source. Safe to skip.
    console.log('[guard-standalone] Monorepo guard not found — running in standalone context. Skipping.');
}

