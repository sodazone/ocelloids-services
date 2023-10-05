#!/usr/bin/env node

import 'dotenv/config';
import process from 'node:process';

import z from 'zod';
import { Command, program } from 'commander';

import version from './version.js';
import { createServer } from './server.js';
import { $ServerOptions } from './types.js';

function startServer(this: Command) {
  try {
    const opts = $ServerOptions.parse(this.opts());
    createServer(opts);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error(err.issues);
    } else {
      console.error(err);
    }
    program.help();
  }
}

program
  .name('xcm-mon')
  .description('XCM Monitoring Server')
  .version(version())
  .option('-c, --config <path>', 'The service configuration file path', process.env.CONFIG_PATH)
  .option('d, --db <path>', 'The database directory path', process.env.DB_PATH ?? './db')
  .action(startServer);

program.parse();
