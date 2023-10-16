import pino from 'pino';
import { AbstractLevel } from 'abstract-level';

export type DB = AbstractLevel<Buffer | Uint8Array | string, string, any>;
export type Logger = pino.BaseLogger;
