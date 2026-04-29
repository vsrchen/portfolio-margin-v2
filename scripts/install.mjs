#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function fail(msg, code = 1) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function run(command, args) {
  log(`\n> ${command} ${args.join(' ')}`);
  const res = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`, res.status ?? 1);
  }
}

function assertNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    fail(`Node.js 20+ is required. Current: ${process.version}`);
  }
}

function main() {
  assertNodeVersion();
  log('Installing repository dependencies and validating setup...');

  run('npm', ['install']);
  run('npm', ['run', 'build']);
  run('npm', ['run', 'test', '-w', '@portfolio-margin/core']);

  log('\nRepository install complete.');
  log('Start the app with: npm run dev -w web');
}

main();
