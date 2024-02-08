# Development

1) Install websocat to interact with the service:

```shell
cargo install --features=ssl websocat
```

2) Run the server with the following configuration:

```toml
[[networks]]
name = "polkadot"
id = 0
throttle = 1_000
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
throttle = 1_000
  [networks.provider]
  type = "rpc"
  url = "wss://acala-rpc-0.aca-api.network"
[[networks]]
name = "hydra"
id = 2_034
relay = "polkadot"
throttle = 1_000
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
[[networks]]
name = "manta"
id = 2_104
relay = "polkadot"
  [networks.provider]
  type = "rpc"
  url = "wss://ws.manta.systems"
```

3) Open a connection with socat:
```shell
websocat -E ws://127.0.0.1:3000/ws/subs | jq .
```

4) Send this payload:
```json
{ "origin": "2004", "senders": "*", "destinations": [ "0","1000", "2000", "2034", "2104" ] }
```

# Load Testing

```shell
npm install -g artillery@latest
````

```shell
artillery run on_demand_load_test.yaml
```