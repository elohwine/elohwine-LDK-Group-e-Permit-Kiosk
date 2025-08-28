#!/usr/bin/env node
// Node wrapper to run the Android release bash script
const { spawnSync } = require('child_process');
const { chmodSync, existsSync } = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '..', 'build-and-sign-apk.sh');

if (!existsSync(scriptPath)) {
  console.error(`Cannot find script: ${scriptPath}`);
  process.exit(1);
}

try {
  // Ensure the script is executable
  chmodSync(scriptPath, 0o755);
} catch (e) {
  // Non-fatal; we'll still try to run via bash
}

const result = spawnSync('bash', [scriptPath], { stdio: 'inherit' });
process.exit(result.status ?? 1);
