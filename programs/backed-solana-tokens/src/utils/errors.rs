use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq)]
pub enum MultiplierUpdaterError {
    #[msg("Invalid multiplier nonce. The provided nonce must be greater than the current nonce.")]
    InvalidMultiplierNonce,
}