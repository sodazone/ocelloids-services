import { FastifyBaseLogger } from 'fastify';

import { ServiceConfiguration } from './configuration.js';

export type ServiceContext = {
  log: FastifyBaseLogger,
  config: ServiceConfiguration
}