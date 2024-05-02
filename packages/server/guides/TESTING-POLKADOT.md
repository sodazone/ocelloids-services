# Polkadot Testing Guide

This guide provides detailed instructions for testing the Ocelloids Service on Polkadot and several parachains.

## 1. Running the Server

> [!NOTE]
> This section describes how to run the server in integrated mode. If you wish to run in distributed mode, i.e. with Redis, please follow the [Distributed Deployment Guide](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/DISTRIBUTED.md).

> [!NOTE]
> If you're using light clients, you will only start receiving new or finalized blocks when warp sync is complete.

You have two options for running the server: through the command line or using Docker.

### 1.1. Command Line

Clone the project repository:

```
git clone https://github.com/sodazone/ocelloids-services.git
```

```
cd ocelloids-services
```

From the root of the project, install and build:

```shell
corepack enable
```

```shell
yarn && yarn server build
```

Create a configuration file for your network. You can use [config/polkadot.toml](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/config/polkadot.toml) for the default Polkadot configuration.

Download the chain specs required for the chains using a light client, as explained in [Annex: Chain Specs](#annex-chain-specs).

From `packages/server/`, run the node using `yarn` and pipe the output to stdout and a file for searching in later:

```shell
yarn oc-node -c ./config/polkadot.toml | tee /tmp/xcm.log
```

#### 1.1.1. Enabling CORS from Command Line

If you are planning to connect to the server from the browser, e.g. from the [XCM Tracker App](#run-xcm-tracker-app-optional), you will need to enable CORS in the server. To do so, simply run the server with the following command:

```shell
yarn server start -c config/polkadot.toml --cors true --address 0.0.0.0 | tee /tmp/xcm.log
```

:star2: Now you can proceed to [2. Add Subscriptions](#2-add-subscriptions).

### 1.2. Docker

Alternatively you can run the server using Docker.

Download the Docker image:

```
docker pull sodazone/ocelloids-integrated-node
```

Or build locally:
 
```
docker build . -t ocelloids-integrated-node:develop
```

> [!NOTE]
> If you are tesing with light clients, download the required chain specs as explained in [Annex: Chain Specs](#annex-chain-specs). Store them in a directory to be mounted later.

Create a configuration file for your network. You can use [config/polkadot.toml](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/config/polkadot.toml) for the default Polkadot configuration.

Run the Docker image, mounting the configuration directory (and chain specs directory if required) as volumes:

```
docker run -d \
  -e OC_CONFIG_FILE=./config/polkadot.toml \
  -p 3000:3000 \
  -v <PATH_TO_CONFIG>:/opt/oc/config \
  sodazone/ocelloids-integrated-node
```

#### 1.2.1. Enabling CORS from Docker

If you are planning to connect to the server from the browser, e.g. from the [XCM Tracker App](#run-xcm-tracker-app-optional), you will need to enable CORS in the server. To do so, simply run the server with the following command:

```shell
docker run \
  -e OC_CONFIG_FILE=./config/polkadot.toml \  
  -e OC_ADDRESS=0.0.0.0 \
  -e OC_CORS=true \
  -p 3000:3000 \
  -v <PATH_TO_CONFIG>:/opt/oc/config \
  sodazone/ocelloids-integrated-node
```

## 2. Add Subscriptions

Use the subscription API to subscribe to cross-chain messages.

The easiest way is to use the [hurl](https://hurl.dev/) example we have prepared, which will subscribe to all channels in the configured network and deliver notifications through both webhook and WebSocket.

First, follow the [installation guide](https://hurl.dev/docs/installation.html) to install hurl.

Then, from the `packages/server/guides/hurl/` directory:

```shell
hurl --variables-file ./dev.env scenarios/transfers/0_create_polkadot.hurl
```

The webhook notifications can be viewed in RequestBin: https://public.requestbin.com/r/enrycp95owk7o.

If you prefer not to install hurl, you can also use `curl`:

```shell
curl 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "asset-hub-transfers",
    "origin": "urn:ocn:polkadot:1000",
    "senders": "*",
    "destinations": ["urn:ocn:polkadot:0", "urn:ocn:polkadot:2000", "urn:ocn:polkadot:2004", "urn:ocn:polkadot:2006", "urn:ocn:polkadot:2034"],
    "channels": [{
      "type": "webhook",
      "url": "https://enrycp95owk7o.x.pipedream.net"
    }]
}]'
```

## 3. Watch for Notifications

Once a cross-chain transfer is made, you should receive a notification.

If you are using notify type=`log`, you can search in the log file using `grep`:

```shell
grep -E "STORED|MATCHED|NOTIFICATION" /tmp/xcm.log
```

Or tail and grep:

```shell
tail -f /tmp/xcm.log | grep -E "STORED|MATCHED|NOTIFICATION"
```

### 3.1. Run XCM Tracker App (Optional)

If you want a convenient UI to view cross-chain transfers, you can run the XCM tracker app. To do so, follow the instructions below:

Clone the tracker app repo:

```shell
git clone https://github.com/sodazone/xcm-tracker.git
```

```shell
cd xcm-tracker
```

```shell
corepack enable
```

Run:

> [!IMPORTANT]
> You will need to have subscriptions configured with WebSocket notification channels for the app to work.

> [!IMPORTANT]
> The service node needs to be running with CORS enabled.
> See [Enabling CORS from Command Line](#111-enabling-cors-from-command-line) or [Enabling CORS from Docker](#121-enabling-cors-from-docker) if it is not yet enabled.

```shell
yarn && yarn dev
```

The app should be running on http://localhost:5173. Select `ALL NETWORKS` from the UI to see XCM activity across all subscribed networks. Alternatively, you can choose to track only a single subscription by clicking `SELECT SUBSCRIPTION`.

## 4. Set up Observability (Optional)

We've provided an example [Docker Compose](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/telemetry/docker-compose.yml) file and sample configurations in the `telemetry` directory to help you set up Prometheus, Grafana, and Alertmanager.

To start, navigate to the directory containing the Docker Compose file:

```shell
# from project root
cd packages/server/guides/telemetry
```

Then run:

```shell
docker compose up
```

If you wish to configure and set up Grafana, please follow the steps in our [Observability Guide](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/OBSERVABILITY.md#grafana).

## 5. Testing Webhook Templates
 
Ocelloids supports templates on Webhook delivery channels, as explained in the [Subscription Guide](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/SUBSCRIPTION.md#templates). If you wish to apply a template to the notification message before delivery to your webhook, you can configure it in your subscriptions.

Add a subscription with a simple template:

```shell
curl 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "polkadot-transfers",
    "origin": "urn:ocn:polkadot:0",
    "senders": "*",
    "destinations": ["urn:ocn:polkadot:1000", "urn:ocn:polkadot:2000", "urn:ocn:polkadot:2004", "urn:ocn:polkadot:2006", "urn:ocn:polkadot:2034"],
    "channels": [{
      "type": "webhook",
      "contentType": "text/plain",
      "template": "NOTIFICATION {{type}} subscription={{subscriptionId}} leg={{waypoint.legIndex}} legs=[{{#each legs}}(from={{from}}, to={{to}}){{/each}}]",
      "url": "https://enrycp95owk7o.x.pipedream.net"
    }]
}]'
```

If you already have active subscriptions, you can update one of your subscriptions with the `PATCH` method:

```shell
curl -X PATCH 'http://127.0.0.1:3000/subs/<subscription-id>' \
--header 'Content-Type: application/json' \
--data '[
  { "op": "replace", "path": "/channels/0", "value": {
      "type": "webhook",
      "contentType": "text/plain",
      "template": "NOTIFICATION {{type}} subscription={{subscriptionId}} leg={{waypoint.legIndex}} legs=[{{#each legs}}(from={{from}}, to={{to}}){{/each}}]",
      "url": <webhook-url>
  } }
]'
```

Make sure to replace `<subscription-id>` and `<webhook-url>` with the ID of the corresponding subscription that you wish to update and the webhook URL that you are using. To list currently active subscriptions, use the following command:

```shell
curl 'http://127.0.0.1:3000/subs'
```

Upon receiving the next notification from the subscription that you have just added or updated, you should receive the message in your webhook transformed by the template:

```
NOTIFICATION xcm.received subscription=asset-hub-transfers leg=1 legs=[(from=urn:ocn:polkadot:1000, to=urn:ocn:polkadot:0)(from=urn:ocn:polkadot:0, to=urn:ocn:polkadot:2034)]
```

## 6. Testing Websocket Notifications

In addition to delivering notification messages through Webhooks, Ocelloids also supports Websocket delivery channels. This enables easy integration of Ocelloids subscriptions into apps. The simplest way to test Websocket support is by using the [Ocelloids Client Library](https://github.com/sodazone/ocelloids-services/tree/main/packages/client). Follow the README to create a simple test app for integration with Websocket subscriptions.

The [XCM Tracker App](https://github.com/sodazone/xcm-tracker) is a demo application that utilizes the Ocelloids Client Library and Websocket subscriptions. You can run the app by following the instructions in [Run XCM Tracker App](#31-run-xcm-tracker-app-optional) to see the Websocket subscriptions in action.

## Troubleshooting

When utilizing light client connections, we've observed occasional issues where, upon server start, the relay chain fails to receive finalized blocks after warp sync is completed. Similarly, chains connecting via light clients might stop receiving finalized blocks after the server has been running for some time. In both scenarios, a system restart typically resolves the issue.

For the moment, we have not been able to deterministically reproduce and pinpoint the cause of these problems. We anticipate that these and similar issues will be resolved as light client implementations become more stable.

You can set up an alert in Prometheus Alertmanager or use the admin API to monitor the blockchain tip, and automate a restart if the tip doesn't progress for a specified duration, like 30 minutes.

To check the current blockchain tip with the admin API:

```shell
curl --silent 'http://127.0.0.1:3000/admin/cache/tips' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.TUkHePbst2jnFffIGHbn-fFnZz36DfBjxsfptqFypaA' | jq .
```

The response will include details about various chain IDs, such as block number, block hash, parent hash, and received timestamp:

<details>
  <summary>Example Output</summary>

```json
[
  [
    "urn:ocn:polkadot:0",
    {
      "chainId": "urn:ocn:polkadot:0",
      "blockNumber": "18079863",
      "blockHash": "0x5c028b0f6be54396cb967168d21fbc3e139b5d3abbeab12d94208331de6f2f8c",
      "parentHash": "0x84035c049a8faeb618dacf407019814ed46eee5fc9086fe51d081716e1cae06f",
      "receivedAt": "2023-11-08T16:05:06.329Z"
    }
  ],
  [
    "urn:ocn:polkadot:1000",
    {
      "chainId": "urn:ocn:polkadot:1000",
      "blockNumber": "4971764",
      "blockHash": "0x64b65cba0a4f4ce5ef13d07ed16071904bb14b85255d18ff85a49908c7f8b4da",
      "parentHash": "0xd6b042a64abee1e4c1d81e7580c820d203c6564c8e59f753cb15e9cedacd90d2",
      "receivedAt": "2023-11-08T16:05:06.158Z"
    }
  ],
  // omitted ...
]
```
</details>

## Annex: Chain Specs

```shell
# Create chain-specs directory
mkdir -p ./chain-specs

# Download chain specs
curl -o ./chain-specs/acala.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/acala.json
curl -o ./chain-specs/astar.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/astar.json
curl -o ./chain-specs/hydradx.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/hydradx.json
```