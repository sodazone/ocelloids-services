# Ocelloids Service Node

[![Docker](https://img.shields.io/docker/v/sodazone/ocelloids-integrated-node?label=docker&style=flat&color=69D2E7&labelColor=A7DBD8&logo=docker&logoColor=444444)](https://hub.docker.com/r/sodazone/ocelloids-integrated-node)
[![CI](https://img.shields.io/github/actions/workflow/status/sodazone/ocelloids-services/ci.yml?branch=main&color=69D2E7&labelColor=A7DBD8)](https://github.com/sodazone/ocelloids-services/actions/workflows/ci.yml)

The Ocelloids Service Node repository provides software components for running programmable offchain layers.

## Key Features

- **Account Management:** Manages user accounts and API tokens to define permissions and ownership. Check the [accounts service README](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/src/services/accounts).
- **Subscription Management:** Provides a flexible API for specifying subscription criteria, including origins, destinations, senders, and delivery channels. Supports both long-lived and on-demand subscriptions, with data streams delivered via webhooks and WebSockets.
- **Dynamic Subscription Updates:** Offers a subscription API for modifying subscription parameters, such as lists of senders and destinations. Seamlessly updates matching criteria in real time without requiring restarts.
- **Aggregated APIs:** Combines multiple data sources and services into unified HTTP endpoints with customizable querying capabilities.
- **Resilience and Reliability:** Ensures uninterrupted operation with persistent data storage across restarts. Supports graceful shutdowns, retries with truncated exponential backoff, reliable webhook delivery, and continuous catch-up of the finalized chain tip, including during forks.
- **Observability:** Exports Prometheus-compatible telemetry metrics.
- **Scalability:** Can run in a distributed manner, decoupling the sourcing of on-chain data from the execution of automation programs.
- **Programmability:** Provides offchain agents as modular building blocks for automation, with each agent offering specific functionalities accessible as data streams and aggregated APIs. Refer to the ["agents" section](https://github.com/sodazone/ocelloids-services/tree/main/packages/server#agents) for the currently available agents.

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
| OC_DATA_DIR                       | The data directory.                            | ./.db     |
| OC_LEVEL_ENGINE                   | The LevelDB engine.                            | classic   |
| OC_DB_SCHEDULER_ENABLE            | Enables or disables the task scheduler.        | true      |
| OC_DB_SCHEDULER_FREQUENCY         | Milliseconds to wait before each tick.         | 5000      |
| OC_DB_JANITOR_SWEEP_EXPIRY        | Milliseconds before a task is swept.           | 1500000   |
| OC_CLOSE_GRACE_DELAY              | Milliseconds for the graceful close to finish. | 5000      |
| OC_JWT_SIG_KEY_FILE               | [Ed25519](https://ed25519.cr.yp.to/) private key used to sign and verify the authorization tokens. | -         |
| OC_JWT_ISSUER                     | Issuer identifier.                             | localhost |
| OC_JWT_ALLOWED_ISSUERS            | Allowed issuers.                               | localhost |
| OC_MAX_BLOCK_DIST                 | Maximum distance in blocks for the catch-up.   | 50        |
| OC_TELEMETRY_ENABLE               | Enables or disables the telemetry service.     | true      |
| OC_WS_MAX_CLIENTS                 | Maximum number of websocket clients.           | 10000     |
| OC_CORS                           | Enables or disables CORS support.              | false     |
| OC_CORS_CREDENTIALS               | Access-Control-Allow-Credentials CORS header.  | true      |
| OC_CORS_ORIGIN                    | Access-Control-Allow-Origin CORS header. Use "true" for any origin. | `/https?://localhost.*/` |
| OC_RATE_LIMIT_MAX                 | Max number of requests per limit window.       | 60        |
| OC_RATE_LIMIT_WINDOW              | Rate limit window in milliseconds.             | 60000     |
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
| type     | Network type is `rpc`.                              |
| url      | WebSocket endpoint URL.                             |

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

Alternatively, if you want to build locally, from the root of the project, run:
 
```shell
docker build . -t ocelloids-integrated-node:develop
```

Run the image mounting the configuration directory as a volume:

```shell
docker run -d \
  -p 3000:3000 \
  -e OC_CONFIG_FILE=./config/<YOUR_CONFIG>.toml \
  -e OC_JWT_SIG_KEY_FILE=<PATH_TO_YOUR_PRIVATE_KEY_FILE> \
  -e OC_JWT_ISSUER=<ISSUER_ID> \
  -e OC_JWT_ALLOWED_ISSUERS=<ISSUER_ID> \
  -v <YOUR_PATH_TO_CONFIG_DIR>:/opt/oc/config:ro \
  sodazone/ocelloids-integrated-node
```

Please replace `PATH_TO_YOUR_PRIVATE_KEY_FILE` with the path to a PEM or JWK-encoded [Ed25519](https://ed25519.cr.yp.to/) private key used to sign and verify the authorization tokens, `ISSUER_ID` with the identifier of the issuer (e.g., 'api.mydomain.io'), and `YOUR_PATH_TO_CONFIG_DIR` with the path to the directory containing the configuration TOML file.

> [!NOTE]
> Example development keys and tokens can be found in the `guides/keys` folder.
> You can copy the private key file, `dev_priv.jwk`, into a directory accessible from within the Docker container.
> These are provided for testing purposes only.
> **DO NOT USE IN PRODUCTION**.

Now you can check if the server is running:
```shell
curl \
-H 'accept: application/json' \
-H 'content-type: application/json' \
-H 'Authorization: Bearer <YOUR_JWT>' \
http://127.0.0.1:3000/health
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
  -a, --address <address>                 address to bind to (default: "localhost", env: OC_ADDRESS)
  -p, --port <number>                     port number to listen on (default: 3000, env: OC_PORT)
  -c, --config <file>                     service configuration file (env: OC_CONFIG_FILE)
  -d, --data <dir>                        data directory (default: "./.db", env: OC_DATA_DIR)
  --level-engine <engine>                 level engine (default: "classic", env: OC_LEVEL_ENGINE)
  --scheduler <boolean>                   enables or disables the task scheduler (default: true, env: OC_DB_SCHEDULER_ENABLE)
  --scheduler-frequency <milliseconds>    milliseconds to wait before each tick (default: 5000, env: OC_DB_SCHEDULER_FREQUENCY)
  --sweep-expiry <milliseconds>           milliseconds before a task is swept (default: 1500000, env: OC_DB_JANITOR_SWEEP_EXPIRY)
  -g, --grace <milliseconds>              milliseconds for the graceful close to finish (default: 5000, env: OC_CLOSE_GRACE_DELAY)
  -t --telemetry <boolean>                enables or disables the telemetry exporter (default: true, env: OC_TELEMETRY_ENABLE)
  --rate-limit-max <number>               set the max number of requests (default: 60, env: OC_RATE_LIMIT_MAX)
  --rate-limit-window <milliseconds>      set the request limit time window (default: 60000, env: OC_RATE_LIMIT_WINDOW)
  -V, --version                           output the version number
  --ws-max-clients <number>               maximum number of websocket clients (default: 10000, env: OC_WS_MAX_CLIENTS)
  --subscription-max-persistent <number>  maximum number of persistent subscriptions (default: 5000, env: OC_SUBSCRIPTION_MAX_PERSISTENT)
  --subscription-max-ephemeral <number>   maximum number of ephemeral subscriptions (default: 5000, env: OC_SUBSCRIPTION_MAX_EPHEMERAL)
  --cors                                  enables CORS support (default: false, env: OC_CORS)
  --cors-credentials <boolean>            configures the Access-Control-Allow-Credentials CORS header (default: true, env: OC_CORS_CREDENTIALS)
  --cors-origin [origin]                  configures the Access-Control-Allow-Origin CORS header
                                          "true" for wildcard, "string" or "/regexp/"
                                          repeat this argument for multiple origins (default: ["/https?://localhost.*/"], env: OC_CORS_ORIGIN)
  --jwt-auth                              enables the JWT authentication (default: false, env: OC_JWT_AUTH)
  --jwt-sig-key-file <path>               path to the EdDSA key in JWK or PEM format (env: OC_JWT_SIG_KEY_FILE)
  --jwt-iss <issuer>                      identity of the issuer (default: "localhost", env: OC_JWT_ISSUER)
  --jwt-allowed-iss [issuer]              allowed issuers, accepts regular expressions (default: ["localhost"], env: OC_JWT_ALLOWED_ISSUERS)
  --redis <redis-url>                     redis[s]://[[username][:password]@][host][:port][/db-number] (env: OC_REDIS_URL)
  --distributed                           distributed mode (default: false, env: OC_DISTRIBUTED)
  -h, --help                              display help for command
```
</details>

### Development

Uses nodemon to automatically restart the application on file changes.

```shell
OC_CONFIG_FILE=<path/to/your-config.toml> yarn dev
```

Replace `<path/to/your-config.toml>` with a valid configuration file path. Configuration examples can be found in the `config/` folder.

## Agents

| ID          | Name              | Description                                                                                |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `informant` | General Informant | Fetches transactions and events using custom MongoQL-compatible filtering expressions.     |
| `xcm`       | XCM Monitor       | Monitors Cross-consensus Message Format (XCM) program executions across consensus systems. |
| `steward`   | Data Steward      | Aggregates and enriches cross-chain metadata for assets and currencies.                    |

For technical details refer to the [agents service README](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/src/services/agents).

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

