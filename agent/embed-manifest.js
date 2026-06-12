'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const rceditBin = path.join(__dirname, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
const exePath   = path.join(__dirname, 'dist', 'agente-it.exe');

execFileSync(rceditBin, [exePath, '--set-requested-execution-level', 'requireAdministrator'], { stdio: 'inherit' });
console.log('[Build] Manifest admin embebido en agente-it.exe');
