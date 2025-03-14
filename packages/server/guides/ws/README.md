# Development

Install `websocat` from releases: https://github.com/vi/websocat/releases
or install from sources:
```shell
cargo install --features=ssl websocat
```

2) Run the server with the following configuration
```toml
[[networks]]
name = "polkadot"
id = 0
  [networks.provider]
  type = "rpc"
  url = "wss://dot-rpc.stakeworld.io"
[[networks]]
name = "asset_hub"
id = 1_000
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url = "wss://polkadot-asset-hub-rpc.polkadot.io"
[[networks]]
name = "acala"
id = 2_000
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url = "wss://acala-rpc-0.aca-api.network"
[[networks]]
name = "astar"
id = "urn:ocn:polkadot:2006"
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url="wss://rpc.astar.network"
[[networks]]
name = "hydra"
id = 2_034
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url = "wss://rpc.hydradx.cloud"
[[networks]]
name = "moonbeam"
id = 2_004
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url = "wss://wss.api.moonbeam.network"
```

# On-demand Subscriptions

1) Open a connection with `websocat`
```shell
websocat -E ws://127.0.0.1:3000/ws/subs | jq .
```

2) Send this payload
```json
{ "agent": "xcm", "args": { "origins": [ "0" ], "senders": "*", "destinations": [ "1000" ] } }
```

# Historical Streams

```json
{ "agent": "xcm", "args": { "origins": "*", "senders": "*", "destinations": "*", "history": { "timeframe": { "start": "2025-03-10T13:58:10.104Z" } } } }
```

```json
{ "agent": "xcm", "args": { "origins": "*", "senders": "*", "destinations": "*", "history": { "timeframe": { "start": "2025-03-10T13:58:10.104Z", "end": "2025-03-10T17:20:10.104Z" } } } }
```

```json
{ "agent": "xcm", "args": { "origins": "*", "senders": "*", "destinations": "*", "history": { "top": 10 } } }
```

# Persistent Subscriptions

1) Create some subscriptions
```shell
hurl --variables-file ./dev.env -v scenarios/transfers/0_create_polkadot.hurl
```

2) Open websocket listeners
```shell
websocat -E ws://127.0.0.1:3000/ws/subs/polkadot-transfers | jq .
```

# Load Testing

1) Install artilley
```shell
npm install -g artillery@latest
```

2) Run some load test
```shell
artillery run <some_load_test.yaml>
```