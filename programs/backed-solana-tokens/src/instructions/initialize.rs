use anchor_lang::prelude::*;
use crate::{
    state::{
        program_data::ProgramData,
    }
};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 32, seeds = [b"program_data"], bump)]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}