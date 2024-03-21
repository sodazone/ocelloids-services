# Distributed Deployment

> [!NOTE]
> The distributed deployment require a running Redis instance.

The distributed deployment architecture consists of three primary layers: distribution middleware handled by Redis, the ingress layer responsible for connecting to onchain sources, and the execution layer for executing hosted programs.

## Distribution Middleware

> [!WARNING]
> Be careful to configure the appropriate security measures in your Redis instance, either packet filtering or authentication.

Redis serves as the distribution middleware.

You can run a Redis instance using Docker:

```shell
docker run --rm -p 6379:6379 --name oc-redis redis
```

## Ingress Layer

The ingress layer is the one connected to onchain sources, either through RPC or P2P protocols. It serves as the unique layer with connectivity to blockchain networks.

Its primary function is to publish onchain data into streams, including extended block data and storage items. Additionally, it maintains a registry of the available networks in the system along with their respective runtime metadata.

Multiple ingress processes can be run simultaneously to source data from different networks.

The streams provide indexed access while retaining the last N items and facilitate load balancing of consumer worker processes through consumer groups when needed.

The source code is located in `packages/server/services/ingress`.

### Command Line

From the root of the project, install and build:

```shell
corepack enable
```

```shell
yarn && yarn build
```

From `packages/server`, run:

```shell
yarn oc-ingress --help
```

Or, in development mode:

```shell
OC_CONFIG_FILE=<path/to/config.toml> yarn dev:ingress
```

<details>
  <summary><strong>Command line options</strong></summary>

```shell
Usage: oc-ingress [options]

Ocelloids Ingress Node

Options:
  -V, --version                         output the version number
  -h, --host <address>                  host to bind to (default: "localhost", env: OC_HOST)
  -p, --port <number>                   port number to listen on (default: 3011, env: OC_PORT)
  -c, --config <file>                   service configuration file (env: OC_CONFIG_FILE)
  -d, --db <dir>                        database directory (default: "./db.ingress", env: OC_DB_DIR)
  --scheduler <boolean>                 enables or disables the task scheduler (default: true, env: OC_DB_SCHEDULER_ENABLE)
  --scheduler-frequency <milliseconds>  milliseconds to wait before each tick (default: 5000, env: OC_DB_SCHEDULER_FREQUENCY)
  --sweep-expiry <milliseconds>         milliseconds before a task is swept (default: 1500000, env: OC_DB_JANITOR_SWEEP_EXPIRY)
  -g, --grace <milliseconds>            milliseconds for the graceful close to finish (default: 5000, env: OC_CLOSE_GRACE_DELAY)
  -t --telemetry <boolean>              enables or disables the telemetry exporter (default: true, env: OC_TELEMETRY_ENABLE)
  --redis <redis-url>                   redis[s]://[[username][:password]@][host][:port][/db-number] (env: OC_REDIS_URL)
  --help                                display help for command
```
</details>

## Execution Layer

The execution layer is responsible for executing hosted programs (also known as agents) in a runtime environment, isolated from blockchain connectivity. Currently, the only available "embedded" program is the XCM matching one; however, this will be abstracted away in subsequent iterations of the system and generalized to provide an execution runtime.

To run the execution layer node, follow the instructions provided in the [Ocelloids Service Node README](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/), with the following parameters:

```shell
oc-node [...] --distributed --redis <redis-url>
```

---

:dizzy::rocket: Have fun!

