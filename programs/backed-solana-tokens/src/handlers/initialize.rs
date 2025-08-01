use anchor_lang::prelude::*;

use crate::instructions::initialize::Initialize;


pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.program_data.owner = ctx.accounts.user.key();

    Ok(())
}
