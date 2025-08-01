use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use crate::{
    state::{
        multiplier_account::MultiplierAccount
    }
};

#[derive(Accounts)]
pub struct UpdateMultiplier<'info> {
    #[account(mut, seeds = [b"multiplier_account", mint.key().as_ref()], bump)]
    pub multiplier_account: Account<'info, MultiplierAccount>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub program: Interface<'info, TokenInterface>,
}
