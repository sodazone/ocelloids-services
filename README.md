# XCM Monitoring Server

## Configuration

The service can support the following parameters from the command line:

```
Usage: xcm-mon [options]

XCM Monitoring Server

Options:
  -V, --version                         output the version number
  -h, --host <address>                  host to bind to (default: "localhost", env: XCMON_HOST)
  -p, --port <number>                   port number to listen on (default: 3000, env: XCMON_PORT)
  -c, --config <file>                   service configuration file (env: XCMON_CONFIG_FILE)
  -d, --db <dir>                        database directory (default: "./db", env: XCMON_DB_DIR)
  --scheduler <boolean>                 enables or disables the task scheduler (default: true, env: XCMON_DB_SCHEDULER_ENABLE)
  --scheduler-frequency <milliseconds>  milliseconds to wait before each tick (default: 30000, env: XCMON_DB_SCHEDULER_FREQUENCY)
  --sweep-expiry <milliseconds>         milliseconds before a task is swept (default: 1500000, env: XCMON_DB_JANITOR_SWEEP_EXPIRY)
  -g, --grace                           milliseconds for the graceful close to finish (env: XCMON_CLOSE_GRACE_DELAY)
  --help                                display help for command
```

You can also use environment variables:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| XCMON_HOST | The host to bind to. | localhost |
| XCMON_PORT | The TCP port number to listen on. | 3000 |
| XCMON_CONFIG_FILE | The service configuration file. | - |
| XCMON_DB_DIR | The database directory.  | ./db |
| XCMON_DB_SCHEDULER_ENABLE | Enables or disables the task scheduler. | true |
| XCMON_DB_SCHEDULER_FREQUENCY | Milliseconds to wait before each tick. | 30000 |
| XCMON_DB_JANITOR_SWEEP_EXPIRY | Milliseconds before a task is swept. | 1500000 |
| XCMON_CLOSE_GRACE_DELAY | Milliseconds for the graceful close to finish. | 500 |

## Subscription API

You can find the OpenAPI documentation at [http://{{host}}/documentation](http://localhost:3000/documentation).

## Healthcheck

The server exposes a healthchek endpoint at [http://{{host}}/health](http://localhost:3000/health).
