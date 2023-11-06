# Testing Guide

This guide provides instructions for testing the XCM Monitoring Server on a Zombienet.

## Setup Zombienet

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

## Running the XCM Monitoring Server

> [!IMPORTANT]
> If any parachain is configured to use smoldot, the relay chain will also need to be configured with smoldot, as the smoldot client requires access to the relay chain to check for para-block inclusion and finality.
> Make sure that you followed the Setup Zombinet and Setup Assets instructions above.

> [!NOTE]
> If you're using light clients, you will only start receiving new or finalized blocks when warp sync is finished.


### Command Line

In a separate terminal, clone the project repository:

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

Create the configuration file for your network, you can just use [config/dev.toml](https://github.com/sodazone/xcm-monitoring/blob/main/config/dev.toml) for the default testing configuration. Ensure that the parameters correspond to those used to set up Zombienet. If you are planning to test with light clients, copy the chain specs for your chains from the temporary folder spawned by Zombienet into the `./chain-specs/` directory pointed in the configuration file. Note that the name of the files should match as well.

For example, with the provided configuration you can copy the chain specs as below, pointing to the temporary directory created by Zombienet:

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

Run the server using npx and pipe the output to stdout and a file for searching in later:

```shell
npx xcm-mon -c ./config/dev.toml | tee /tmp/xcm.log
```

:star2: Now you can proceed to [Add Subscriptions](https://github.com/sodazone/xcm-monitoring/blob/main/guides/TESTING.md#add-subscriptions) and [Transfer Assets](https://github.com/sodazone/xcm-monitoring/blob/main/guides/TESTING.md#transfer-assets).

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

## Add Subscriptions

Use the subscription API to subscribe to cross-chain messages.

Below is an example request to subscribe to cross-chain messages between parachain 1000 and either relay chain or parachain 2000, sent from `//Alice` or `//Bob` account. The notification type is set to `log` to view notifications in the console:

```shell
curl --location 'http://127.0.0.1:3000/subs' \
--header 'Content-Type: application/json' \
--data '[{
    "id": "asset-hub-transfers",
    "origin": 1000,
    "senders": ["HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F", "FoQJpPyadYccjavVdTWxpxU7rUEaYhfLCPwXgkfD6Zat9QP"],
    "destinations": [0, 2000],
    "notify": {
        "type": "log"
    }
}]'
```

## Transfer Assets

> [!NOTE]
> The following instructions refer to the XCM Testing Tools repository.

Utilize the [scripts](https://github.com/sodazone/xcm-testing-tools#assets-tranfser) in the `xcm-testing-tools` project to initiate a reserve-backed asset transfer using either Alice's or Bob's account.

```shell
just transfer ws://127.0.0.1:9910 -s //Alice -d 2000 -r 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY -a 1984 -m 1500000000000
```

After the extrinsic is finalized, you will receive similar logs in the console to indicate a notification:

```
[12:07:07 UTC] INFO: [2000:i] STORED hash=0x20ad5ddb54c87125bbaf7e90329db6e5ffd577478b96d85034d2826b91c65fce:2000 (subId=asset-hub-transfers)
[12:07:07 UTC] INFO: [1000:o] MATCHED hash=0x20ad5ddb54c87125bbaf7e90329db6e5ffd577478b96d85034d2826b91c65fce:2000
[12:07:07 UTC] INFO: [1000 ➜ 2000] NOTIFICATION subscription=asset-hub-transfers, messageHash=0x20ad5ddb54c87125bbaf7e90329db6e5ffd577478b96d85034d2826b91c65fce, outcome=Success (o: #217, d: #216)
```

In this example, the message on the destination chain was captured first. This is not a problem since the XCM Monitoring Server supports matching messages out-of-order.

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

## Update the Notification Method

The subscription API allows you to update your notification method. In this example, we will update the notification from type `log` to type `webhook`.

You can use any web hook testing service, in the example below we are using [https://webhook.site](https://webhook.site).

Example request:

```shell
curl --location --request PATCH 'http://127.0.0.1:3000/subs/asset-hub-transfers' \
--header 'Content-Type: application/json' \
--data '[
  { "op": "replace", "path": "/notify", "value": {
      "type": "webhook",
      "url": "https://webhook.site/faf64821-cb4d-41ad-bb81-fd119e80ad02"
  } }
]'
```

Now, if you make another transfer, the notification should be delivered to your endpoint with a message similar to the one below:

<details>
  <summary>JSON Notification</summary>

```json
{
  "subscriptionId":"asset-hub-transfers",
  "origin":{
    "chainId":1000,
    "blockNumber":"271",
    "blockHash":"0x2165b67e8ec89291633b6a10fab68a62b868cc69ab5ab2dd1e21372c4e5f3f62",
    "extrinsicId":"271-2",
    "event":{
      "eventId":"271-2-2",
      "extrinsicId":"271-2",
      "extrinsicPosition":2,
      "blockNumber":"271",
      "blockHash":"0x2165b67e8ec89291633b6a10fab68a62b868cc69ab5ab2dd1e21372c4e5f3f62",
      "method":"XcmpMessageSent",
      "section":"xcmpQueue",
      "index":"0x1e04",
      "data":{
        "messageHash":"0x825d998fc7f68a85777087d88d1e78951d25be433ac3240f5193884f949cf86a"
      }
    }
  },
  "destination":{
    "chainId":"2000",
    "blockNumber":"268",
    "blockHash":"0x0390ae32561ab87524fb5f0765604a519ca66a3aec64b8ca6c2ab81e455f2a03",
    "extrinsicId":"268-1",
    "event":{
      "eventId":"268-1-1",
      "extrinsicId":"268-1",
      "extrinsicPosition":1,
      "blockNumber":"268",
      "blockHash":"0x0390ae32561ab87524fb5f0765604a519ca66a3aec64b8ca6c2ab81e455f2a03",
      "method":"Success",
      "section":"xcmpQueue",
      "index":"0x3200",
      "data":{
        "messageHash":"0x825d998fc7f68a85777087d88d1e78951d25be433ac3240f5193884f949cf86a",
        "weight":{
          "refTime":"5,000,000,000",
          "proofSize":"327,680"
        }
      }
    }
  },
  "messageHash":"0x825d998fc7f68a85777087d88d1e78951d25be433ac3240f5193884f949cf86a",
  "messageData":"0x000314010400010300a10f043205011f0002286bee0a1300010300a10f043205011f0002286bee000d01020400010100d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d2cdde8ae7392d5e34e2aadd1976eb1540a18238f2f48bfde9058f3e1ec7c840899",
  "instructions":{
    "V3":[
      {
        "ReserveAssetDeposited":[
          {
            "id":{
              "Concrete":{
                "parents":"1",
                "interior":{
                  "X3":[
                    {
                      "Parachain":"1,000"
                    },
                    {
                      "PalletInstance":"50"
                    },
                    {
                      "GeneralIndex":"1,984"
                    }
                  ]
                }
              }
            },
            "fun":{
              "Fungible":"1,000,000,000"
            }
          }
        ]
      },
      "ClearOrigin",
      {
        "BuyExecution":{
          "fees":{
            "id":{
              "Concrete":{
                "parents":"1",
                "interior":{
                  "X3":[
                    {
                      "Parachain":"1,000"
                    },
                    {
                      "PalletInstance":"50"
                    },
                    {
                      "GeneralIndex":"1,984"
                    }
                  ]
                }
              }
            },
            "fun":{
              "Fungible":"1,000,000,000"
            }
          },
          "weightLimit":"Unlimited"
        }
      },
      {
        "DepositAsset":{
          "assets":{
            "Wild":{
              "AllCounted":"1"
            }
          },
          "beneficiary":{
            "parents":"0",
            "interior":{
              "X1":{
                "AccountId32":{
                  "network":null,
                  "id":"0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
                }
              }
            }
          }
        }
      },
      {
        "SetTopic":"0xdde8ae7392d5e34e2aadd1976eb1540a18238f2f48bfde9058f3e1ec7c840899"
      }
    ]
  },
  "sender": {
    "Id": "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"
  },
  "outcome":"Success",
  "error":null
}
```
</details>

## Update Senders and Destinations

You can easily modify the list of senders and destinations through the subscription API using a JSON PATCH request. The monitor dynamically adjusts its matching criteria to incorporate these changes.

For instance, to add Ferdie and remove Alice from the list of senders being monitored, use the following request:

```shell
curl --location --request PATCH 'http://127.0.0.1:3000/subs/asset-hub-transfers' \
--header 'Content-Type: application/json' \
--data '[
  { "op": "add", "path": "/senders/-", "value": "DE14BzQ1bDXWPKeLoAqdLAm1GpyAWaWF1knF74cEZeomTBM"},
  { "op": "remove", "path": "/senders/0"}
]'
```

After making these changes, any cross-chain transfers from parachain 1000 initiated with Bob's or Ferdie's account will trigger a notification, while transfers from Alice's account will not prompt any notifications.

## Troubleshooting

While testing on Zombienet, you might encounter a network error in smoldot,  `[sync-service-rococo_local_testnet] Error while verifying justification: There exists a block in-between the latest finalized block and the block targeted by the justification that must first be finalized` which can flood the server. If this occurs, please restart the server to resolve the issue.


Additionally, if you come across a smoldot panic like the one shown below, it is advisable to restart both Zombienet and the server:

```shell
[smoldot] Smoldot v1.0.4. Current memory usage: 57.7 MiB. Average download: 446 kiB/s. Average upload: 251 kiB/s.
Smoldot has panicked while executing task `network-service`. This is a bug in smoldot. Please open an issue at https://github.com/smol-dot/smoldot/issues with the following message:
panicked at 'called `Option::unwrap()` on a `None` value', /__w/smoldot/smoldot/lib/src/network/service/notifications.rs:320:88
[16:09:46 UTC] ERROR: 
    err: {
      "type": "Error",
      "message": "",
      "stack":
          Error
              at Object.onPanic (file:///home/xueying/dev/sodazone/xcm-monitoring/node_modules/smoldot/dist/mjs/instance/raw-instance.js:36:23)
              at panic (file:///home/xueying/dev/sodazone/xcm-monitoring/node_modules/smoldot/dist/mjs/instance/bindings-smoldot-light.js:52:20)
              at wasm://wasm/00fc8eb6:wasm-function[2764]:0xa0317
              at wasm://wasm/00fc8eb6:wasm-function[12523]:0x282f48
              at wasm://wasm/00fc8eb6:wasm-function[12513]:0x2823a7
              at wasm://wasm/00fc8eb6:wasm-function[12518]:0x282a47
              at wasm://wasm/00fc8eb6:wasm-function[12590]:0x2888ed
              at wasm://wasm/00fc8eb6:wasm-function[12597]:0x288e15
              at wasm://wasm/00fc8eb6:wasm-function[3312]:0xa8e9c
              at wasm://wasm/00fc8eb6:wasm-function[5292]:0x10f4ae
    }
```

Moreover, after Zombienet has been operational for some time, there may be instances where the parachains become stalled. In such cases, restarting Zombienet will refresh the network.

It's worth noting that the issues described above appear to be unique to Zombienet, as similar behavior has not been observed when running the monitoring server on public networks like Polkadot and its parachains.