# Solana multiplier updater with nonce contract

This repo contains the helper program, that is responsible for maintaining multiplier nonce for ScaledUI extension of xStocks tokens.

## Functionality

This program is holding each token multiplier nonce in form of separate, mint specific, PDA (`[b"multiplier_account", <mint_pubkey>]`), following similar structure of current/new multiplier nonce and activation time, in similar fashion that ScaledUIExtension is doing for multiplier.

This program does not hold authority over ScaledUIExtension, but instead relies on a caller to be assigned as authority of the extension.

## Tests

Currently this repo does not contain functioning tests, but rather just a single file with an example of how to run and use this program, which is placed in `./tests/backed-solana-tokens.ts` file.