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

## Troubleshooting

When utilizing light client connections, we've observed occasional issues where, upon server start, the relay chain fails to receive finalized blocks after warp sync is completed. Similarly, chains connecting via light clients might stop receiving finalized blocks after the server has been running for some time. In both scenarios, a system restart typically resolves the issue.

For the moment, we have not been able to deterministically reproduce and pinpoint the cause of these problems. We anticipate that these and similar issues will be resolved as light client implementations become more stable.

To check the current blockchain tip, you can use the admin API, as shown below:

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
    "0",
    {
      "chainId": "0",
      "blockNumber": "18079863",
      "blockHash": "0x5c028b0f6be54396cb967168d21fbc3e139b5d3abbeab12d94208331de6f2f8c",
      "parentHash": "0x84035c049a8faeb618dacf407019814ed46eee5fc9086fe51d081716e1cae06f",
      "receivedAt": "2023-11-08T16:05:06.329Z"
    }
  ],
  [
    "1000",
    {
      "chainId": "1000",
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

You can use the admin API to monitor the blockchain tip and automate a restart if the tip doesn't progress for a specified duration, like 30 minutes.

In the future, our plan is to implement Prometheus monitoring, providing better insights into the server's performance and allowing for proactive issue detection and resolution.

## Annex: Chain Specs

```shell
# Create chain-specs directory
mkdir -p ./chain-specs

# Download chain specs
curl -o ./chain-specs/acala.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/acala.json
curl -o ./chain-specs/astar.json https://raw.githubusercontent.com/sodazone/substrate-chain-specs/main/polkadot/astar.json
```