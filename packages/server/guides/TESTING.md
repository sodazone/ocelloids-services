# Testing

## Unit Testing

To run unit tests, from `packages/server` execute:

```shell
yarn test
```

Run unit tests with coverage report:

```shell
yarn test:coverage
```

## Integration Testing

For HTTP tests please refer to [Hurl Tests](https://github.com/sodazone/ocelloids-services/tree/main/packages/server/guides/hurl/tests).

## Stress Testing

You can use [artillery](https://www.artillery.io/) to run the suites located in `guides/artillery`.

```shell
artillery run ./artillery/on_demand_subscriptions.yaml
```

