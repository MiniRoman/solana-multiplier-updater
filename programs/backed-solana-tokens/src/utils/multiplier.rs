use anchor_lang::prelude::*;

use crate::{instructions::update_multiplier::UpdateMultiplier, state::multiplier_account::MultiplierAccount};

pub fn current_multiplier_nonce(ctx: &Context<UpdateMultiplier>) -> Result<u64> {
    let clock = Clock::get()?;

    let multiplier_account: &Account<'_, MultiplierAccount> =
        &ctx.accounts.multiplier_account;

    // if the current new multiplier's timestamp has passed, set it as the old
    if clock.unix_timestamp >= i64::from(multiplier_account.activation_time) {
        multiplier_account.new_multiplier_nonce;
    }

    Ok(multiplier_account.multiplier_nonce)
}
