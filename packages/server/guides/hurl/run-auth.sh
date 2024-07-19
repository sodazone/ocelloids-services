#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")"

hurl --test --variables-file dev.env scenarios/auth/*.hurl