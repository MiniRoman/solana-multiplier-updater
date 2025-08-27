#[cfg(test)]
mod tests {
    use anchor_lang::prelude::*;
    use crate::state::{multiplier_account::MultiplierAccount, program_data::ProgramData};

    #[test]
    fn test_multiplier_account_default_values() {
        let multiplier_account = MultiplierAccount {
            new_multiplier: 1.0,
            multiplier_nonce: 0,
            new_multiplier_nonce: 0,
            activation_time: 0,
        };
        
        // Test initial state
        assert_eq!(multiplier_account.new_multiplier, 1.0);
        assert_eq!(multiplier_account.multiplier_nonce, 0);
        assert_eq!(multiplier_account.new_multiplier_nonce, 0);
        assert_eq!(multiplier_account.activation_time, 0);
    }

    #[test]
    fn test_multiplier_account_with_future_activation() {
        let future_timestamp = 9999999999i64; // Far future timestamp
        let multiplier_account = MultiplierAccount {
            new_multiplier: 2.5,
            multiplier_nonce: 1,
            new_multiplier_nonce: 2,
            activation_time: future_timestamp,
        };
        
        assert_eq!(multiplier_account.new_multiplier, 2.5);
        assert_eq!(multiplier_account.multiplier_nonce, 1);
        assert_eq!(multiplier_account.new_multiplier_nonce, 2);
        assert_eq!(multiplier_account.activation_time, future_timestamp);
    }

    #[test]
    fn test_program_data_structure() {
        let dummy_pubkey = Pubkey::new_unique();
        let program_data = ProgramData {
            owner: dummy_pubkey,
        };
        
        assert_eq!(program_data.owner, dummy_pubkey);
    }

    #[test]
    fn test_multiplier_account_extreme_values() {
        // Test with extreme multiplier values
        let multiplier_account_high = MultiplierAccount {
            new_multiplier: f64::MAX,
            multiplier_nonce: u64::MAX - 1,
            new_multiplier_nonce: u64::MAX,
            activation_time: i64::MAX,
        };
        
        assert_eq!(multiplier_account_high.new_multiplier, f64::MAX);
        assert_eq!(multiplier_account_high.multiplier_nonce, u64::MAX - 1);
        assert_eq!(multiplier_account_high.new_multiplier_nonce, u64::MAX);
        assert_eq!(multiplier_account_high.activation_time, i64::MAX);

        let multiplier_account_low = MultiplierAccount {
            new_multiplier: 0.0,
            multiplier_nonce: 0,
            new_multiplier_nonce: 0,
            activation_time: i64::MIN,
        };
        
        assert_eq!(multiplier_account_low.new_multiplier, 0.0);
        assert_eq!(multiplier_account_low.multiplier_nonce, 0);
        assert_eq!(multiplier_account_low.new_multiplier_nonce, 0);
        assert_eq!(multiplier_account_low.activation_time, i64::MIN);
    }
}