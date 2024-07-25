# Hurl HTTP Requests

## Installation

To get started, you need to install Hurl. Visit [hurl.dev](https://hurl.dev) for installation instructions.

## Example Usage

Run a development server with the dev keys, in the `packages/server` directory:

```shell
yarn dev -- --jwt-auth --jwt-sig-key-file guides/keys/dev_priv.jwk --config config/polkadot.toml
```

To run a scenario, in the `guides/hurl` directory:

```shell
hurl --very-verbose --variables-file ./dev.env scenarios/transfers/0_create_dev.hurl
```

You can run the tests using the following command:

```shell
hurl --very-verbose --variables-file ./dev.env --test tests/**/*.hurl
```

or create some subscriptions:

```shell
hurl --very-verbose --variables-file ./dev.env -v scenarios/transfers/0_create_dev.hurl
```
