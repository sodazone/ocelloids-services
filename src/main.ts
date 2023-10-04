#!/usr/bin/env node

import { Command, program } from 'commander';

import { createServer } from './server.js';
import { ServerOptions } from './types.js';

function startServer(this: Command) {
  const opts = this.opts<ServerOptions>();
  createServer(opts);
}

program
  .name('xcm-mon')
  .description('XCM Monitoring Server')
  .requiredOption('-c, --config <path>')
  .option('d, --db <path>', './db')
  .action(startServer)
  .parse();
