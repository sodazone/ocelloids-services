import { Command } from 'commander'
import { opt, optBool, optInt } from './args.js'

export function addServerOptions(command: Command) {
  return command
    .addOption(opt('-a, --address <address>', 'address to bind to', 'OC_ADDRESS').default('localhost'))
    .addOption(optInt('-p, --port <number>', 'port number to listen on', 'OC_PORT').default(3000))
    .addOption(opt('-c, --config <file>', 'service configuration file', 'OC_CONFIG_FILE'))
    .addOption(opt('-d, --data <dir>', 'database directory', 'OC_DATA_DIR').default('./.db'))
    .addOption(opt('--level-engine <engine>', 'level engine', 'OC_LEVEL_ENGINE').default('classic'))
    .addOption(
      optBool(
        '--scheduler <boolean>',
        'enables or disables the task scheduler',
        'OC_DB_SCHEDULER_ENABLE',
      ).default(true),
    )
    .addOption(
      optInt(
        '--scheduler-frequency <milliseconds>',
        'milliseconds to wait before each tick',
        'OC_DB_SCHEDULER_FREQUENCY',
      ).default(5_000), // 5 secs
    )
    .addOption(
      optInt(
        '--sweep-expiry <milliseconds>',
        'milliseconds before a task is swept',
        'OC_DB_JANITOR_SWEEP_EXPIRY',
      ).default(25 * 60_000), // 25 minutes
    )
    .addOption(
      optInt(
        '-g, --grace <milliseconds>',
        'milliseconds for the graceful close to finish',
        'OC_CLOSE_GRACE_DELAY',
      ).default(5_000),
    )
    .addOption(
      optBool(
        '-t --telemetry <boolean>',
        'enables or disables the telemetry exporter',
        'OC_TELEMETRY_ENABLE',
      ).default(true),
    )
    .addOption(
      optInt('--rate-limit-max <number>', 'set the max number of requests', 'OC_RATE_LIMIT_MAX').default(60),
    )
    .addOption(
      optInt(
        '--rate-limit-window <milliseconds>',
        'set the request limit time window',
        'OC_RATE_LIMIT_WINDOW',
      ).default(60_000),
    )
}
