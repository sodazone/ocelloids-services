# Zombienet Testing Guide

This guide provides instructions for testing the XCM Monitoring Server on a Zombienet.

## 1. Set Up Zombienet

We have a separate project repository called [XCM Testing Tools](https://github.com/sodazone/xcm-testing-tools) to assist with setting up a Zombienet ready for cross-chain asset transfers.

Clone the testing repo and navigate to its directory:

```
git clone https://github.com/sodazone/xcm-testing-tools.git
```

```
cd xcm-testing-tools/
```

Follow the instruction in the project [XCM Testing Tools](https://github.com/sodazone/xcm-testing-tools) to [set up a Zombienet](https://github.com/sodazone/xcm-testing-tools#zombienet-setup).

Follow the instructions in the same project to [set up the test assets](https://github.com/sodazone/xcm-testing-tools#assets-configuration).

At this point you should have running a Zombienet with the default testing configuration: Rococo local relay chain, Asset Hub local parachain and Shibuya local parachain, and you should have configured the assets and sovereign accounts required for testing XCM transfers.

## 2. Running the Server

> [!IMPORTANT]
> If any parachain is configured to use smoldot, the relay chain will also need to be configured with smoldot, as the smoldot client requires access to the relay chain to check for para-block inclusion and finality.
> Make sure that you followed the Setup Zombinet and Setup Assets instructions above.

> [!NOTE]
> If you're using light clients, you will only start receiving new or finalized blocks when warp sync is finished.

In a separate terminal, clone the project repository:

```shell
git clone https://github.com/sodazone/ocelloids-services.git
```

```shell
cd ocelloids-services
```

From the root of the project, install and build:

```shell
corepack enable
```

```shell
yarn && yarn server build
```

Create the configuration file for your network, you can just use [config/dev.toml](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/config/dev.toml) for the default testing configuration. Ensure that the parameters correspond to those used to set up Zombienet. If you are planning to test with light clients, copy the chain specs for your chains from the temporary folder spawned by Zombienet into the `./chain-specs/` directory pointed in the configuration file. Note that the name of the files should match as well.

For example, with the provided configuration you can copy the chain specs as shown below:

```shell
# Create chain-specs directory
mkdir chain-specs

# Relay chain Alice node chain-spec
cp /tmp/zombie-<RANDOM>/rococo-local.json chain-specs/rococo-local-relay.json

# Astar collator
cp /tmp/zombie-<RANDOM>/shibuya-dev-2000-rococo-local.json chain-specs/shibuya-local.json

## Replace tokyo for rococo_local_testnet
sed -i 's/tokyo/rococo_local_testnet/g' chain-specs/shibuya-local.json

# Asset Hub collator
cp /tmp/zombie-<RANDOM>/asset-hub-kusama-local-1000-rococo-local.json chain-specs/assethub-local.json
```

Please, replace `zombie-<RANDOM>` with the temporary directory created by Zombienet.

From `packages/server/`, run the node using `yarn` and pipe the output to stdout and a file for searching in later:

```shell
yarn oc-node -c ./config/dev.toml | tee /tmp/xcm.log
```

## 3. Add Subscriptions

Use the subscription API to subscribe to cross-chain messages.

Below is an example request to subscribe to cross-chain messages between parachain 1000 and either relay chain or parachain 2000, sent from `//Alice` or `//Bob` account. The notification type is set to `log` to view notifications in the console:

```shell
curl 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "asset-hub-transfers",
    "origin": "urn:ocn:local:1000",
    "senders": ["5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"],
    "destinations": ["urn:ocn:local:0", "urn:ocn:local:2000"],
    "channels": [{
        "type": "log"
    }]
}]'
```

Alternatively, you can use the avaible hurl example to create subscriptions. From the `packages/server/guides/hurl/` directory:

```shell
hurl --variables-file ./dev.env scenarios/transfers/0_create_dev.hurl
``` 

## 4. Transfer Assets

> [!IMPORTANT]
> Before transferring assets you must configure the assets as specified in [1. Set Up Zombienet](#1-set-up-zombienet).

> [!NOTE]
> The following instructions refer to the XCM Testing Tools repository.

Utilize the [scripts](https://github.com/sodazone/xcm-testing-tools#assets-tranfser) in the `xcm-testing-tools` project to initiate a reserve-backed asset transfer using Alice's account.

```shell
just transfer ws://127.0.0.1:9910 -s //Alice -d 2000 -r ajYMsCKsEAhEvHpeA4XqsfiA9v1CdzZPrCfS6pEfeGHW9j8 -a 1984 -m 1500000000000 --asset-registry ./config/asset-registries/local-rococo.json
```

After the extrinsic is finalized, you will receive similar logs in the console to indicate a notification:

```shell
[11:24:05 UTC] INFO: [urn:ocn:local:1000:r] RELAYED key=asset-hub-transfers:0xbbde23d294a4906d1670e21b5865519de428d9a416057d0da66a7ab521782d41:urn:ocn:local:1000 (subId=asset-hub-transfers, block=0xaccd37bccff145fb06068aabf11a85fdf7477b7ffccbe181b632c82d742062c7 #49)
[11:24:05 UTC] INFO: [urn:ocn:local:1000 ↠ urn:ocn:local:2000] NOTIFICATION xcm.relayed subscription=asset-hub-transfers, messageHash=0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0, block=110
[11:24:05 UTC] INFO: [urn:ocn:local:1000 ➜] NOTIFICATION xcm.sent subscription=asset-hub-transfers, messageHash=0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0, block=49
[11:24:05 UTC] INFO: [urn:ocn:local:1000:h] STORED stop=urn:ocn:local:0 hash=asset-hub-transfers:0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0:urn:ocn:local:0 id=asset-hub-transfers:0xbbde23d294a4906d1670e21b5865519de428d9a416057d0da66a7ab521782d41:urn:ocn:local:0 (subId=asset-hub-transfers, block=0xaccd37bccff145fb06068aabf11a85fdf7477b7ffccbe181b632c82d742062c7 #49)
[11:24:05 UTC] INFO: [urn:ocn:local:1000:o] STORED dest=urn:ocn:local:2000 hash=asset-hub-transfers:0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0:urn:ocn:local:2000 id=asset-hub-transfers:0xbbde23d294a4906d1670e21b5865519de428d9a416057d0da66a7ab521782d41:urn:ocn:local:2000 (subId=asset-hub-transfers, block=0xaccd37bccff145fb06068aabf11a85fdf7477b7ffccbe181b632c82d742062c7 #49)
[11:24:09 UTC] INFO: [urn:ocn:local:0] FINALIZED block #112 0xa8404b8bf5cf95cc38ae8d72a138e30622424ded72a9a9b696d5f1dd215dde9d
[11:24:17 UTC] INFO: [urn:ocn:local:0] FINALIZED block #113 0x40e535085d7e4f57cee1997acbcc60dcbebb86c22b14e542eb1cfadde6b4826e
[11:24:17 UTC] INFO: [urn:ocn:local:2000] FINALIZED block #50 0x93677fd655392b943b8c8715bd6bd617d3e2843fd45f1cae2c8eb5f35d758892
[11:24:17 UTC] INFO: [urn:ocn:local:1000] FINALIZED block #50 0xe5342a23c937be807fe62784d2ee9dac3a6efbd6067483f8f3bbe37e1bbaa604
[11:24:17 UTC] INFO: [urn:ocn:local:2000:i] MATCHED hash=asset-hub-transfers:0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0:urn:ocn:local:2000 (subId=asset-hub-transfers, block=0x93677fd655392b943b8c8715bd6bd617d3e2843fd45f1cae2c8eb5f35d758892 #50)
[11:24:17 UTC] INFO: [urn:ocn:local:1000 ➜ urn:ocn:local:2000] NOTIFICATION xcm.received subscription=asset-hub-transfers, messageHash=0xd431e297031b1301db3227096a208d284b9eeac214d96d42d72491e450b9c4d0, outcome=Fail (o: #49, d: #50)
```

In this example, the message on the relay chain was captured first. This is not a problem since the XCM Monitoring Server supports matching messages out-of-order.

You can search in the log file using grep:

```shell
grep -E "STORED|MATCHED|NOTIFICATION" /tmp/xcm.log
```

Or tail and grep:

```shell
tail -f /tmp/xcm.log | grep -E "STORED|MATCHED|NOTIFICATION"
```

> [!NOTE]
> Connecting with light clients may result in a slightly longer wait for finalized blocks compared to RPC connections. Consequently, you might notice a short delay in notifications when using light clients.

## 5. Update the Notification Method

The subscription API allows you to update your notification method. In this example, we will update the notification from type `log` to type `webhook`.

You can use any webhook testing service, in the example below we are using [https://webhook.site](https://webhook.site).

Example request:

```shell
curl -X PATCH 'http://127.0.0.1:3000/subs/asset-hub-transfers' \
--header 'Content-Type: application/json' \
--data '[
  { "op": "replace", "path": "/channels/0", "value": {
      "type": "webhook",
      "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
  } }
]'
```

Now, if you make another transfer, the notifications should be delivered to your endpoint.

## 6. Update Senders and Destinations

You can easily modify the list of senders and destinations through the subscription API using a JSON PATCH request. The monitor dynamically adjusts its matching criteria to incorporate these changes.

For instance, to add Ferdie and remove Alice from the list of senders being monitored, use the following request:

```shell
curl -X PATCH 'http://127.0.0.1:3000/subs/asset-hub-transfers' \
--header 'Content-Type: application/json' \
--data '[
  { "op": "add", "path": "/senders/-", "value": "DE14BzQ1bDXWPKeLoAqdLAm1GpyAWaWF1knF74cEZeomTBM"},
  { "op": "remove", "path": "/senders/0"}
]'
```

After making these changes, any cross-chain transfers from parachain 1000 initiated with Bob's or Ferdie's account will trigger a notification, while transfers from Alice's account will not prompt any notifications.

## Troubleshooting

After Zombienet has been operational for some time, there may be instances where the parachains become stalled. In such cases, restarting Zombienet will refresh the network.

It's worth noting that the issues described above appear to be unique to Zombienet, as similar behavior has not been observed when running the monitoring server on public networks like Polkadot and its parachains.
