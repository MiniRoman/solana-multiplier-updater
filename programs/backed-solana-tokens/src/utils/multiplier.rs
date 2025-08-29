use anchor_lang::prelude::*;

use crate::{instructions::update_multiplier::UpdateMultiplier, state::multiplier_account::MultiplierAccount};

pub fn current_multiplier_nonce(ctx: &Context<UpdateMultiplier>) -> Result<u64> {
    current_multiplier_nonce_from_account(&ctx.accounts.multiplier_account)
}

pub fn current_multiplier_nonce_from_account(multiplier_account: &Account<MultiplierAccount>) -> Result<u64> {
    let clock = Clock::get()?;

    // if the current new multiplier's timestamp has passed, return the new nonce
    if clock.unix_timestamp >= multiplier_account.activation_time {
        Ok(multiplier_account.new_multiplier_nonce)
    } else {
        Ok(multiplier_account.multiplier_nonce)
    }
}
