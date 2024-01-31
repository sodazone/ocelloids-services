# XCM Monitoring Server

[![Docker](https://img.shields.io/docker/v/sodazone/xcm-monitoring?label=docker&style=flat&color=69D2E7&labelColor=A7DBD8&logo=docker&logoColor=444444)](https://hub.docker.com/r/sodazone/xcm-monitoring)
[![CI](https://img.shields.io/github/actions/workflow/status/sodazone/xcm-monitoring/ci.yml?branch=main&color=69D2E7&labelColor=A7DBD8)](https://github.com/sodazone/xcm-monitoring/actions/workflows/ci.yml)

The XCM Monitoring Server is a software application designed to monitor Cross-Consensus Message Format (XCM)
program executions across consensus systems. Users can configure specific blockchain networks for observation and create subscriptions based on origin and destination chains, as well as sender addresses through a web API. The server delivers real-time notifications to the endpoints specified in the subscriptions, providing timely updates about relevant interactions. The currently supported XCM protocols are XCMP-lite (HRMP) and VMP.

## Key Features

- **Execution Monitoring:** The server tracks XCM program executions across various networks.
- **Subscription Management:** The server offers a flexible subscription API for users to define specific criteria for notifications. Customizable parameters include origin, senders, destinations, and notification methods.
- **Dynamic Subscription Updates:** The subscription API allows users to modify subscription parameters, such as list of senders and destinations. The monitor seamlessly updates its matching criteria in real-time, without need for restarts.
- **Light client support:** The server supports connecting to chains through smoldot, in addition to RPC endpoints, thereby reducing infrastructure needs by eliminating the necessity of running full nodes or relying on RPC providers.
- **Resilience and Reliability:** The server ensures uninterrupted operation with persistent data storage between restarts. It supports graceful shutdowns, retries employing truncated exponential backoff, reliable webhook delivery, continuous chain tip catch-up, and efficient caching for light clients.

The XCM Monitoring Server utilizes the [Ocelloids Monitoring SDK](https://github.com/sodazone/ocelloids) for the implementation of its monitoring logic.

## Configuration

### Server Configuration

The server configuration uses the environment variables described in the table below.
The configuration values can be overridden using command line arguments.

| Variable                      | Description                                    | Default   |
| ----------------------------- | ---------------------------------------------- | --------- |
| XCMON_HOST                    | The host to bind to.                           | localhost |
| XCMON_PORT                    | The TCP port number to listen on.              | 3000      |
| XCMON_CONFIG_FILE             | The service configuration file.                | -         |
| XCMON_DB_DIR                  | The database directory.                        | ./db      |
| XCMON_DB_SCHEDULER_ENABLE     | Enables or disables the task scheduler.        | true      |
| XCMON_DB_SCHEDULER_FREQUENCY  | Milliseconds to wait before each tick.         | 5000      |
| XCMON_DB_JANITOR_SWEEP_EXPIRY | Milliseconds before a task is swept.           | 1500000   |
| XCMON_CLOSE_GRACE_DELAY       | Milliseconds for the graceful close to finish. | 500       |
| XCMON_SECRET                  | Secret passphrase for administration auth.     | -         |
| XCMON_MAX_BLOCK_DIST          | Maximum distance in blocks for the catch-up.   | 50        |

### Network Configuration

To configure network connections, you need to provide a configuration file in TOML format. The accepted configuration fields are as follows:

| Field    | Description                                                                                        | Optional   |
| ---------| -------------------------------------------------------------------------------------------------- | ---------- |
| name     | The name of the network.                                                                           | No         |
| id       | The ID of the network.                                                                             | No         |
| relay    | For parachains, the name of the relay chain it connects to.                                        | Yes        |
| throttle | The throttle interval, in milliseconds, for requesting historic headers during chain tip catch-up. | Yes        |
| provider | Provider configuration, detailed below.                                                            | No         |

Provider configuration fields:

| Field    | Description                                         |
| ---------| --------------------------------------------------- |
| type     | Network type, either `rpc` or `smoldot`.            |
| url      | WebSocket endpoint URL, applicable when type=`rpc`. |
| spec     | Path to the chain specs, used when type=`smoldot`. Required when **not** using [well-known chain](https://github.com/paritytech/substrate-connect/blob/main/packages/connect/src/WellKnownChain.ts) names. |

Example configurations are available in the `config/` directory of this repository for reference.

## Running the Server

### Docker

Alternatively you can run the server using Docker.

Download the Docker image:

```
docker pull sodazone/xcm-monitoring
```

Or build locally:
 
```
docker build . -t xcm-monitoring:develop
```

Run the image mounting the configuration and chain specs as volumes:

```
docker run -d \
  -e XCMON_CONFIG_FILE=./config/<YOUR_CONFIG>.toml \
  -p 3000:3000 \
  -v <PATH_TO_CHAIN_SPECS>:/opt/xcmon/chain-specs \
  -v <PATH_TO_CONFIG>:/opt/xcmon/config \
  sodazone/xcm-monitoring
```

### Command Line

Install and build:

```shell
corepack enable
```

```shell
yarn && yarn build
```

Run:

```shell
yarn xcm-mon --help
```

```shell
Usage: xcm-mon [options]

XCM Monitoring Server

Options:
  -V, --version                         output the version number
  -h, --host <address>                  host to bind to (default: "localhost", env: XCMON_HOST)
  -p, --port <number>                   port number to listen on (default: 3000, env: XCMON_PORT)
  -c, --config <file>                   service configuration file (env: XCMON_CONFIG_FILE)
  -d, --db <dir>                        database directory (default: "./db", env: XCMON_DB_DIR)
  --scheduler <boolean>                 enables or disables the task scheduler (default: true, env: XCMON_DB_SCHEDULER_ENABLE)
  --scheduler-frequency <milliseconds>  milliseconds to wait before each tick (default: 5000, env: XCMON_DB_SCHEDULER_FREQUENCY)
  --sweep-expiry <milliseconds>         milliseconds before a task is swept (default: 1500000, env: XCMON_DB_JANITOR_SWEEP_EXPIRY)
  -g, --grace <milliseconds>            milliseconds for the graceful close to finish (env: XCMON_CLOSE_GRACE_DELAY)
  --help                                display help for command
```

### Development

Uses nodemon to automatically restart the application on file changes.

```shell
yarn dev
```

## HTTP APIs

The XCM Monitoring Server offers convenient APIs for seamless interaction.

Explore the [Postman collection](https://github.com/sodazone/xcm-monitoring/tree/main/guides/postman) for comprehensive usage examples.

### Subscription API

The subscription HTTP API allows you to create and manage subscriptions to XCM interactions of your interest.

The OpenAPI documentation is published at the path [/documentation](http://localhost:3000/documentation) in your running server.

Fore more details, refer to [Subscription HTTP API Guide](https://github.com/sodazone/xcm-monitoring/blob/main/guides/SUBSCRIPTION.md)

### Administration API

The server provides an API for administration purposes. It facilitates tasks such as reading and purging cached data, pending XCM messages and scheduled tasks. You can also consult the current chain tip of a network through this API.

For more details, refer to our [Administration Guide](https://github.com/sodazone/xcm-monitoring/blob/main/guides/ADMINISTRATION.md). 

### Healthcheck

The server exposes a healthchek endpoint at [/health](http://localhost:3000/health).

## Testing

To run unit tests:

```shell
yarn test
```

For end-to-end testing with Polkadot please refer to our [Polkadot Testing Guide](https://github.com/sodazone/xcm-monitoring/blob/main/guides/TESTING-POLKADOT.md).

For end-to-end testing with Zombienet please refer to our [Zombienet Testing Guide](https://github.com/sodazone/xcm-monitoring/blob/main/guides/TESTING-ZOMBIENET.md).

## Notes

### Chain Head Catch-up

When subscribing to finalized block headers using the light client, it's possible to skip blocks occasionally. To ensure we don't miss any finalized blocks, we've implemented a chain head catch-up mechanism. This mechanism requests the missing block headers, ensuring no gaps in our data. The same approach is applied during server restarts to recover missed blocks from server downtime. Currently, we've set an upper limit of 50 blocks and a default throttle of 1 second to prevent overloading the peers connected to the light client. In the future, we plan to develop a more robust catch-up mechanism to handle historical chain head catch-up scenarios effectively.