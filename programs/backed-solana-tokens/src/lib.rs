
use anchor_lang::prelude::*;

pub mod handlers;
pub mod instructions;
pub mod state;
pub mod utils;

use handlers::*;
use instructions::initialize::*;
use instructions::initialize_token::*;
use instructions::update_multiplier::*;

declare_id!("9ieG4SHhHLPB4XtmpmMxZqHXQ9WRaTZfgT7aAFXYrvzs");

#[program]
pub mod multiplier_updater {
    use crate::utils::multiplier::current_multiplier_nonce;

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }
    
    pub fn initialize_token(ctx: Context<InitializeToken>) -> Result<()> {
        Ok(())
    }

    pub fn update_multiplier(ctx: Context<UpdateMultiplier>, multiplier: f64, activation_time: i64) -> Result<()> {
        let current_multiplier_nonce = current_multiplier_nonce(&ctx)?;
        let new_multiplier_nonce = current_multiplier_nonce + 1;
        update_multiplier::handler(ctx, multiplier, activation_time, new_multiplier_nonce)
    }

    pub fn update_multiplier_with_nonce(ctx: Context<UpdateMultiplier>, multiplier: f64, activation_time: i64, multiplier_nonce: u64) -> Result<()> {
        update_multiplier::handler(ctx, multiplier, activation_time, multiplier_nonce)
    }
}
