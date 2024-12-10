/* c8 ignore next */
export const environment = process.env.NODE_ENV || 'development'

const NON_PROD = ['test', 'development']

export function isNonProdEnv(envName: string): boolean {
  return NON_PROD.includes(envName)
}

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
}

export const logger = envToLogger[environment]
