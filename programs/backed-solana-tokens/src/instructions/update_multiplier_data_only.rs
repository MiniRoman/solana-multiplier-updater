use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::{
    multiplier_account::MultiplierAccount,
    program_data::ProgramData,
};

#[derive(Accounts)]
pub struct UpdateMultiplierDataOnly<'info> {
    #[account(seeds = [b"program_data"], bump)]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut, seeds = [b"multiplier_account", mint.key().as_ref()], bump)]
    pub multiplier_account: Account<'info, MultiplierAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = owner.key() == program_data.owner)]
    pub owner: Signer<'info>,
}