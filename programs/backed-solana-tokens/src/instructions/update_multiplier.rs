use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use crate::{
    state::{
        multiplier_account::MultiplierAccount,
        program_data::ProgramData,
    }
};

#[derive(Accounts)]
pub struct UpdateMultiplier<'info> {
    #[account(seeds = [b"program_data"], bump)]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut, seeds = [b"multiplier_account", mint.key().as_ref()], bump)]
    pub multiplier_account: Account<'info, MultiplierAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = user.key() == program_data.owner)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub program: Interface<'info, TokenInterface>,
}
