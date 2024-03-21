# Testing

## Unit Testing

To run unit tests:

```shell
yarn test
```

## Integration Testing

For end-to-end testing with Polkadot please refer to our [Polkadot Testing Guide](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/TESTING-POLKADOT.md).

For end-to-end testing with Zombienet please refer to our [Zombienet Testing Guide](https://github.com/sodazone/ocelloids-services/blob/main/packages/server/guides/TESTING-ZOMBIENET.md).

For HTTP tests please refer to [Hurl Tests](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/hurl/tests).

## Stress Testing

You con use [artillery](https://www.artillery.io/) to run the suites located in `guides/artillery`.

```shell
artillery run ./artillery/on_demand_subscriptions.yaml
```

