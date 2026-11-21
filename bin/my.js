#!/usr/bin/env node
import { runCli } from '../src/cli/index.js';

runCli(process.argv).catch((err) => {
  console.error('\x1b[31mFatal:\x1b[0m', err?.message ?? err);
  process.exit(1);
});
