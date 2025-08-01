use anchor_lang::prelude::*;

pub fn update_multiplier<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, ScaledUIUpdateMultiplier<'info>>,
    multiplier: f64,
    activation_time: i64,
) -> Result<()> {
    let ix = spl_token_2022::extension::scaled_ui_amount::instruction::update_multiplier(
        ctx.accounts.token_program_id.key,
        ctx.accounts.mint.key,
        ctx.accounts.authority.key,
        &[ctx.accounts.authority.key],
        multiplier,
        activation_time,
    )?;
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[ctx.accounts.token_program_id, ctx.accounts.mint, ctx.accounts.authority],
        ctx.signer_seeds,
    )
    .map_err(Into::into)
}

#[derive(Accounts)]
pub struct ScaledUIUpdateMultiplier<'info> {
    /// CHECK:` doc comment explaining why no checks through types are necessary.
    pub token_program_id: AccountInfo<'info>,
    /// CHECK:` doc comment explaining why no checks through types are necessary.
    pub mint: AccountInfo<'info>,
    /// CHECK:` doc comment explaining why no checks through types are necessary.
    pub authority: AccountInfo<'info>,
}