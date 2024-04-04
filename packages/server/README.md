# Ocelloids Service Node

[![Docker](https://img.shields.io/docker/v/sodazone/ocelloids-integrated-node?label=docker&style=flat&color=69D2E7&labelColor=A7DBD8&logo=docker&logoColor=444444)](https://hub.docker.com/r/sodazone/ocelloids-integrated-node)
[![CI](https://img.shields.io/github/actions/workflow/status/sodazone/ocelloids-services/ci.yml?branch=main&color=69D2E7&labelColor=A7DBD8)](https://github.com/sodazone/ocelloids-services/actions/workflows/ci.yml)

The Ocelloids Service Node repository provides software components for running programmable offchain layers.

> [!NOTE]
> Ocelloids is transitioning to a generalized execution model. Currently, the Ocelloids Node only supports XCM monitoring logic.
> You can monitor Cross-Consensus Message Format (XCM) program executions across consensus systems. Users can configure specific blockchain networks for observation and create subscriptions based on origin and destination chains, as well as sender addresses through a web API. The server delivers real-time notifications to the delivery channels specified in the subscriptions, providing timely updates about relevant interactions. The currently supported XCM protocols are XCMP-lite (HRMP) and VMP.

## Key Features

- **Subscription Management:** Flexible API for specifying subscription criteria, including origin, destinations, senders, and delivery channels. Supports long-lived and on-demand subscriptions, delivering notifications via webhooks and websockets.
- **Dynamic Subscription Updates:** Exposes a subscription API for modifying subscription parameters, such as lists of senders and destinations. Seamlessly updates matching criteria in real-time, without need for restarts.
- **Light client support:** Connects to chains through smoldot, in addition to RPC endpoints, reducing infrastructure needs by eliminating the necessity of running full nodes or relying on RPC providers.
- **Resilience and Reliability:** Ensures uninterrupted operation with persistent data storage between restarts. Supports graceful shutdowns, retries employing truncated exponential backoff, reliable webhook delivery, continuous chain tip catch-up, and efficient caching for light clients.
- **Observability:** Exports Prometheus-compatible telemetry metrics.
- **Scalability:** Can run in a distributed way, decoupling the sourcing of onchain data from the execution of automation programs.

## Configuration

### Service Node Configuration

The service node configuration uses the environment variables described in the table below.
The configuration values can be overridden using command line arguments.

<details>
  <summary><strong>Environment variables table</strong></summary>

| Variable                          | Description                                    | Default   |
| --------------------------------- | ---------------------------------------------- | --------- |
| OC_ADDRESS                        | The address to bind to.                        | localhost |
| OC_PORT                           | The TCP port number to listen on.              | 3000      |
| OC_CONFIG_FILE                    | The service configuration file.                | -         |
| OC_DATA_DIR                       | The database directory.                        | ./db      |
| OC_DB_SCHEDULER_ENABLE            | Enables or disables the task scheduler.        | true      |
| OC_DB_SCHEDULER_FREQUENCY         | Milliseconds to wait before each tick.         | 5000      |
| OC_DB_JANITOR_SWEEP_EXPIRY        | Milliseconds before a task is swept.           | 1500000   |
| OC_CLOSE_GRACE_DELAY              | Milliseconds for the graceful close to finish. | 5000      |
| OC_SECRET                         | Secret passphrase for administration auth.     | -         |
| OC_MAX_BLOCK_DIST                 | Maximum distance in blocks for the catch-up.   | 50        |
| OC_TELEMETRY_ENABLE               | Enables or disables the telemetry service.     | true      |
| OC_WS_MAX_CLIENTS                 | Maximum number of websocket clients.           | 10000     |
| OC_CORS_ENABLE                    | Enables or disables CORS support.              | false     |
| OC_CORS_CREDENTIALS               | Access-Control-Allow-Credentials CORS header.  | true      |
| OC_CORS_ORIGIN                    | Access-Control-Allow-Origin CORS header.       | `/https?://localhost.*/` |
| OC_SUBSCRIPTION_MAX_PERSISTENT    | Maximum number of persistent subscriptions.    | 5000      |
| OC_SUBSCRIPTION_MAX_EPHEMERAL     | Maximum number of ephemeral subscriptions.     | 5000      |
| OC_DISTRIBUTED                    | Enables distributed mode for the exeuctor.     | false     |
| OC_REDIS_URL                      | Redis connection URL.[^1]                      | redis://localhost:6379 |

[^1]: Redis URL format `redis[s]://[[username][:password]@][host][:port][/db-number]`.
</details>

If you are looking for a distributed deployment, [check the guide for details on running decoupled service layers](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/DISTRIBUTED.md).

### Network Configuration

To configure network connections, you need to provide a configuration file in TOML format. 

<details>
  <summary><strong>Configuration file details</strong></summary>

The accepted configuration fields are as follows:

| Field      | Description                                                                                        | Required   | Default |
| ---------  | -------------------------------------------------------------------------------------------------- | ---------- | ------- |
| name       | The name of the network.                                                                           | Yes        | n/a     |
| id         | The ID of the network.[^2]                                                                         | Yes        | n/a     |
| provider   | Provider configuration, detailed below.                                                            | Yes        | n/a     |
| relay      | For parachains, the name of the relay chain it connects to.                                        | No         | n/a     |
| recovery   | Enbles or disables the recovery of interrupted catch-ups.                                          | No         | false   |
| batch-size | The batch size for catching up missed blocks.                                                      | No         | 25      |

Provider configuration fields:

| Field    | Description                                         |
| ---------| --------------------------------------------------- |
| type     | Network type, either `rpc` or `smoldot`.            |
| url      | WebSocket endpoint URL, applicable when type=`rpc`. |
| spec     | Path to the chain specs, used when type=`smoldot`. Required when **not** using [well-known chain](https://github.com/paritytech/substrate-connect/blob/main/packages/connect/src/WellKnownChain.ts) names. |

Example configurations are available in the `config/` directory of this repository for reference.

[^2]: Network ID format `urn:ocn:[consensus]:[chainId]`, where `consensus` is one of the values in [XCM NetworkId](https://paritytech.github.io/polkadot-sdk/master/staging_xcm/v4/enum.NetworkId.html) or `local`.
</details>

## Running the Service Node

> [!NOTE]
> The following commands are for running the node in integrated mode. If you wish to run in distributed mode, i.e. with Redis, please refer to our [Distributed Deployment Guide](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/DISTRIBUTED.md).

### Docker

You can run an integrated Service Node using Docker.

Download the Docker image:

```shell
docker pull sodazone/ocelloids-integrated-node
```

Or build locally:
 
```shell
docker build . -t ocelloids-integrated-node:develop
```

Run the image mounting the configuration and chain specs as volumes:

```shell
docker run -d \
  -e OC_CONFIG_FILE=./config/<YOUR_CONFIG>.toml \
  -p 3000:3000 \
  -v <PATH_TO_CHAIN_SPECS>:/opt/oc/chain-specs \
  -v <PATH_TO_CONFIG>:/opt/oc/config \
  sodazone/ocelloids-integrated-node
```

### Command Line

> [!IMPORTANT]
> The Ocelloids Service Node requires `node.js >= 20`.

From the root of the project, install and build:

```shell
corepack enable
```

```shell
yarn && yarn server build
```

From `packages/server`, run:

```shell
yarn oc-node --help
```

<details>
  <summary><strong>Command line options</strong></summary>

```shell
Usage: oc-node [options]

Ocelloids Service Node

Options:
  -V, --version                           output the version number
  -a, --address <address>                 address to bind to (default: "localhost", env: OC_ADDRESS)
  -p, --port <number>                     port number to listen on (default: 3000, env: OC_PORT)
  -c, --config <file>                     service configuration file (env: OC_CONFIG_FILE)
  -d, --data <dir>                        database directory (default: "./db", env: OC_DATA_DIR)
  --scheduler <boolean>                   enables or disables the task scheduler (default: true, env: OC_DB_SCHEDULER_ENABLE)
  --scheduler-frequency <milliseconds>    milliseconds to wait before each tick (default: 5000, env: OC_DB_SCHEDULER_FREQUENCY)
  --sweep-expiry <milliseconds>           milliseconds before a task is swept (default: 1500000, env: OC_DB_JANITOR_SWEEP_EXPIRY)
  -g, --grace <milliseconds>              milliseconds for the graceful close to finish (default: 5000, env: OC_CLOSE_GRACE_DELAY)
  -t --telemetry <boolean>                enables or disables the telemetry exporter (default: true, env: OC_TELEMETRY_ENABLE)
  --ws-max-clients <number>               maximum number of websocket clients (default: 10000, env: OC_WS_MAX_CLIENTS)
  --subscription-max-persistent <number>  maximum number of persistent subscriptions (default: 5000, env: OC_SUBSCRIPTION_MAX_PERSISTENT)
  --subscription-max-ephemeral <number>   maximum number of ephemeral subscriptions (default: 5000, env: OC_SUBSCRIPTION_MAX_EPHEMERAL)
  --cors                                  enables CORS support (default: false, env: OC_CORS)
  --cors-credentials <boolean>            configures the Access-Control-Allow-Credentials CORS header (default: true, env: OC_CORS_CREDENTIALS)
  --cors-origin [origin]                  configures the Access-Control-Allow-Origin CORS header
                                          "true" for wildcard, "string" or "/regexp/"
                                          repeat this argument for multiple origins (default: ["/https?://localhost.*/"], env: OC_CORS_ORIGIN)
  --distributed                           distributed mode (default: false, env: OC_DISTRIBUTED)
  --redis <redis-url>                     redis[s]://[[username][:password]@][host][:port][/db-number] (env: OC_REDIS_URL)
  -h, --help                              display help for command
```
</details>

### Development

Uses nodemon to automatically restart the application on file changes.

```shell
OC_CONFIG_FILE=config/manta.toml yarn dev
```

## HTTP APIs

The Ocelloids Service Node offers convenient APIs for seamless interaction.

[Explore the provided HTTP APIs for subscription management, administration, and health checks](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/HTTP_APIS.md).

## Observability

The Ocelloids Service Node exposes observability metrics via Prometheus, enabling visualization through Grafana dashboards and the configuration of alerts via Alertmanager.

[Setup Prometheus, Grafana and Alertmanager](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/OBSERVABILITY.md).

## Testing

[Run unit tests and explore end-to-end testing guides for Polkadot and Zombienet](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/TESTING.md).

---

Stay fresh! :zap::flamingo::palm_tree: 

