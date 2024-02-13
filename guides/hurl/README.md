# Hurl HTTP Requests

## Installation

To get started, you need to install Hurl. Visit [hurl.dev](https://hurl.dev) for installation instructions.

## Example Usage

You can run the tests using the following command:

```shell
hurl --variables-file ./dev.env --test tests/**/*.hurl
```

or create some subscriptions:

```shell
hurl --variables-file ./dev.env -v scenarios/transfers/0_create.hurl
```
