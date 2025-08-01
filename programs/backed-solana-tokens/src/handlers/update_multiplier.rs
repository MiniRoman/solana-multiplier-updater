use crate::{
    instructions::update_multiplier::UpdateMultiplier,
    state::multiplier_account::MultiplierAccount,
    utils::{
        errors::MultiplierUpdaterError, multiplier::current_multiplier_nonce,
        token2022::update_multiplier::*,
    },
};
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<UpdateMultiplier>,
    multiplier: f64,
    activation_time: i64,
    multiplier_nonce: u64,
) -> Result<()> {
    let current_nonce = current_multiplier_nonce(&ctx)?;

    if multiplier_nonce <= current_nonce {
        return Err(MultiplierUpdaterError::InvalidMultiplierNonce.into());
    }

    let new_active_nonce = {
        let clock = Clock::get()?;

        // if the current new multiplier's timestamp has passed, set it as the old
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

    let cpi_accounts = ScaledUIUpdateMultiplier {
        token_program_id: ctx.accounts.program.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let cpi_program = ctx.accounts.program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    update_multiplier(cpi_context, multiplier as f64, activation_time)?;

    Ok(())
}
