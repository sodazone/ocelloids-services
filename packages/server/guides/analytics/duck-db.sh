#!/usr/bin/env bash
set -eu

. .env

R2="CREATE SECRET (
    TYPE r2,
    KEY_ID '${R2_KEY_ID}',
    SECRET '${R2_SECRET}',
    ACCOUNT_ID '${R2_ACCOUNT_ID}'
);"

duckdb -line -cmd "$R2" -ui