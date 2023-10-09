import { AbstractLevel } from 'abstract-level';

export type DB = AbstractLevel<Buffer | Uint8Array | string, string, any>;

