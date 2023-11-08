# Polkadot Testing Guide

This guide provides detailed instructions for testing the XCM Monitoring Server on Polkadot and several parachains.

## 1. Running the Server

> [!NOTE]
> If you're using light clients, you will only start receiving new or finalized blocks when warp sync is complete.

You have two options for running the server: through the command line or using Docker.

### 1.1. Command Line

Clone the project repository:

```
git clone https://github.com/sodazone/xcm-monitoring.git
```

```
cd xcm-monitoring
```

Install and build the project:

```
npm i && npm run build
```

Create a configuration file for your network. You can use [config/polkadot.toml](https://github.com/sodazone/xcm-monitoring/blob/main/config/polkadot.toml) for the default Polkadot configuration.

Download the chain specs required for the chains using a light client, as explained in [Annex: Chain Specs](#annex-chain-specs).

Run the server using `npx` and pipe the output to both stdout and a file for future searching:

```shell
npx xcm-mon -c ./config/polkadot.toml | tee /tmp/xcm.log
```

:star2: Now you can proceed to [2. Add Subscriptions](#2-add-subscriptions).

### 1.2. Docker

Alternatively you can run the server using Docker.

Download the Docker image:

```
docker pull sodazone/xcm-monitoring
```

Or build locally:
 
```
docker build . -t xcm-monitoring:develop
```

Download the chain specs required for the chains using a light client, as explained in [Annex: Chain Specs](#annex-chain-specs). Store them in a directory to be mounted later.

Create a configuration file for your network. You can use [config/polkadot.toml](https://github.com/sodazone/xcm-monitoring/blob/main/config/polkadot.toml) for the default Polkadot configuration.

Run the Docker image, mounting the configuration and chain specs as volumes:

```
docker run -d \
  -e XCMON_CONFIG_FILE=./config/<YOUR_CONFIG>.toml \
  -p 3000:3000 \
  -v <PATH_TO_CHAIN_SPECS>:/opt/xcmon/chain-specs \
  -v <PATH_TO_CONFIG>:/opt/xcmon/config \
  sodazone/xcm-monitoring
```

## 2. Add Subscriptions

Use the subscription API to subscribe to cross-chain messages.

To monitor transfers from any account in Asset Hub to Polkadot Relay, Acala, Astar, or Moonbeam, use the following request:

```shell
curl 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "asset-hub-transfers",
    "origin": 1000,
    "senders": "*",
    "destinations": [0, 2000, 2004, 2006],
    "notify": {
        "type": "log"
    }
}]'
```

This request will log the notifications in the console. If you want to test with a webhook endpoint, simply configure the `notify` parameter to point to your endpoint.

In the example below we are using [https://webhook.site](https://webhook.site) as a webhook testing service.

```shell
curl 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "acala-transfers",
    "origin": 2000,
    "senders": "*",
    "destinations": [0, 1000, 2004, 2006],
    "notify": {
        "type": "webhook",
        "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
    }
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

## Annex: Chain Specs

```shell
# Create chain-specs directory
mkdir -p ./chain-specs

# Download chain specs
curl -o ./chain-specs/polkadot.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/polkadot.json

curl -o ./chain-specs/acala.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/acala.json

curl -o ./chain-specs/astar.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/astar.json
```