import pino from 'pino';

import { ServiceConfiguration } from './configuration.js';

export type ServiceContext = {
  log: pino.BaseLogger,
  config: ServiceConfiguration
}