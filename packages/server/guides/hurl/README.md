# Hurl HTTP Requests

## Installation

To get started, you need to install Hurl. Visit [hurl.dev](https://hurl.dev) for installation instructions.

## Example Usage

To run a scenario:

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
