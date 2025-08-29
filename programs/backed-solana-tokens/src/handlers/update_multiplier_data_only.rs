use anchor_lang::prelude::*;
use crate::{
    instructions::update_multiplier_data_only::UpdateMultiplierDataOnly,
    state::multiplier_account::MultiplierAccount,
    utils::{errors::MultiplierUpdaterError, multiplier::current_multiplier_nonce_from_account},
};

pub fn handler(
    ctx: Context<UpdateMultiplierDataOnly>,
    multiplier: f64,
    activation_time: i64,
    multiplier_nonce: u64,
) -> Result<()> {
    let current_nonce = current_multiplier_nonce_from_account(&ctx.accounts.multiplier_account)?;

    if multiplier_nonce <= current_nonce {
        return Err(MultiplierUpdaterError::InvalidMultiplierNonce.into());
    }

    let new_active_nonce = {
        let clock = Clock::get()?;

        if clock.unix_timestamp >= i64::from(activation_time) {
            multiplier_nonce
        } else {
            current_nonce
        }
    };

    let multiplier_account: &mut Account<'_, MultiplierAccount> =
        &mut ctx.accounts.multiplier_account;
    multiplier_account.new_multiplier = multiplier;
    multiplier_account.activation_time = activation_time;
    multiplier_account.multiplier_nonce = new_active_nonce;
    multiplier_account.new_multiplier_nonce = multiplier_nonce;

    Ok(())
}