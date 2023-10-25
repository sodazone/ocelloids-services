/* istanbul ignore next */
export const environment = process.env.NODE_ENV || 'development';

const envToLogger: Record<string, any> = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

export const logger = envToLogger[environment];