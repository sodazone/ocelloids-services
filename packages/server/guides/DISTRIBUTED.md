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

The ingress layer is connected to onchain sources through RPC or P2P protocols. It serves as the unique layer with connectivity to blockchain networks.

Its primary function is to publish onchain data into streams, including extended block data and storage items. Additionally, it maintains a registry of the available networks in the system along with their respective runtime metadata.

Multiple ingress processes can be run simultaneously to source data from different networks.

The streams provide indexed access while retaining the last N items and facilitate load balancing of consumer worker processes through consumer groups when needed.

The source code is located in `packages/server/services/ingress`.

### Running from Command Line

From the root of the project, install and build:

```shell
corepack enable
```

```shell
yarn && yarn build
```

From `packages/server`, run:

```shell
OC_CONFIG_FILE=<path/to/your-config.toml> yarn oc-ingress --redis <redis-url>
```

You can use `./config/minimal.toml` as `<path/to/your-config.toml>` for a minimal configuration for Polkadot and Assethub. Use `redis://127.0.0.1:6379` for `<redis-url>`.

> [!NOTE]
> For development purposes you can run:
> ```shell
> OC_CONFIG_FILE=<path/to/config.toml> yarn dev:ingress
> ```

After running an ingress node, proceed to run an execution node, as described below.

## Execution Layer

The execution layer executes hosted programs (also known as agents) in a runtime environment, isolated from blockchain connectivity. Currently, the only available "embedded" program is the XCM matching one; however, this will be abstracted away in subsequent iterations of the system and generalized to provide an execution runtime.

To run the execution layer node, follow the instructions provided in the [Ocelloids Service Node README](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/), with the additional parameters `distributed` and `redis` as shown below.

From `packages/server`, run:

```shell
yarn oc-node --config <path/to/your-config.toml> --distributed --redis <redis-url> --address 0.0.0.0
```

You can use `./config/minimal.toml` as `<path/to/your-config.toml>` and `redis://127.0.0.1:6379` as `<redis-url>`.

### Create a Webhook Subscription

> [!IMPORTANT]
> If you don't have a webhook receiver, you can set one up at https://webhook.site/ and use your unique URL as <YOUR_WEBHOOK_URL> in the curl command.

Now, you can create a webhook subscription using curl:

```shell
curl -v -H "Content-Type: application/json" -d '{
  "id": "unique-sub-name-1",
  "origin": "urn:ocn:polkadot:0",
  "senders": "*",
  "destinations": ["urn:ocn:polkadot:1000"],
  "channels": [{
    "type": "webhook",
    "url": "<YOUR_WEBHOOK_URL>"
  }]
}' http://127.0.0.1:3000/subs
```

Any XCM activity from Polkadot to Assethub will be sent to your webhook.

---

:dizzy::rocket: Have fun!

