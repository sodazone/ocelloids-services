# XCM Monitoring Server

## Configuration

The service can support the following parameters from the command line:

```shell
Usage: xcm-mon [options]

XCM Monitoring Server

Options:
  -V, --version         output the version number
  -h, --host <address>  host to bind to (default: "localhost", env: XCMON_HOST)
  -p, --port <number>   port number to listen on (default: 3000, env: XCMON_PORT)
  -c, --config <path>   service configuration file path (env: XCMON_CONFIG_PATH)
  -d, --db <path>       database directory path (default: "./db", env: XCMON_DB_PATH)
  -g, --grace           milliseconds for the graceful close to finish (env: XCMON_CLOSE_GRACE_DELAY)
  --help                display help for command
```

You can also use environment variables:

| Variable | Description | Default |
| -------- | ----------- | ------- |
| XCMON_HOST | The host to bind to. | localhost |
| XCMON_PORT | The TCP port number to listen on. | 3000 |
| XCMON_CLOSE_GRACE_DELAY | Milliseconds for the graceful close to finish. | 500 |