use anchor_lang::prelude::*;
use crate::instructions::transfer_ownership::TransferOwnership;

pub fn handler(ctx: Context<TransferOwnership>) -> Result<()> {
    ctx.accounts.program_data.owner = ctx.accounts.new_owner.key();
    Ok(())
}