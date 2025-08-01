use anchor_lang::prelude::*;

#[account]
pub struct MultiplierAccount {
    pub new_multiplier: f64,
    pub multiplier_nonce: u64,
    pub new_multiplier_nonce: u64,
    pub activation_time: i64,
}