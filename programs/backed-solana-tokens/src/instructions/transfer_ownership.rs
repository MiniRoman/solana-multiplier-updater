use anchor_lang::prelude::*;
use crate::state::program_data::ProgramData;

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut, seeds = [b"program_data"], bump)]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut, constraint = current_owner.key() == program_data.owner)]
    pub current_owner: Signer<'info>,

    /// CHECK: This is the new owner address, validated in handler
    pub new_owner: AccountInfo<'info>,
}
