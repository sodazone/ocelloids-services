import fs from 'node:fs';

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { ServerOptions } from './types.js';

export type NetworkConfiguration = {
  name: string,
  id: number,
  relay?: string,
  provider: {
    type: 'rpc' | 'smoldot',
    url?: string,
    spec?: string
  }
}

export type ServiceConfiguration = {
  networks: NetworkConfiguration[]
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ServiceConfiguration
  }
}

const configPluginCallback: FastifyPluginAsync<ServerOptions> = async (fastify, options) => {
  const configPath = options.config;

  fastify.log.info(`Loading configuration from ${configPath}`);

  // TODO validation
  const config = JSON.parse(
    fs.readFileSync(configPath, 'utf-8')
  ) as ServiceConfiguration;

  fastify.decorate('config', config);
};

export default fp(configPluginCallback, { fastify: '>=4.x', name: 'config' });
