use anchor_lang::prelude::*;

#[account]
pub struct ProgramData {
    pub owner: Pubkey,
}
