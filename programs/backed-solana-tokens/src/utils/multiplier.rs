use anchor_lang::prelude::*;

use crate::{instructions::update_multiplier::UpdateMultiplier, state::multiplier_account::MultiplierAccount};

pub fn current_multiplier_nonce(ctx: &Context<UpdateMultiplier>) -> Result<u64> {
    let clock = Clock::get()?;

    let multiplier_account: &Account<'_, MultiplierAccount> =
        &ctx.accounts.multiplier_account;

    // if the current new multiplier's timestamp has passed, return the new nonce
    if clock.unix_timestamp >= multiplier_account.activation_time {
        Ok(multiplier_account.new_multiplier_nonce)
    } else {
        Ok(multiplier_account.multiplier_nonce)
    }
}
