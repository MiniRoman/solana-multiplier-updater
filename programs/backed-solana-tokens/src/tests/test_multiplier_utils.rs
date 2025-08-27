#[cfg(test)]
mod tests {
    use crate::state::multiplier_account::MultiplierAccount;

    // Note: These tests demonstrate the structure for unit testing utility functions
    // However, testing current_multiplier_nonce requires proper Context setup
    // which is more suitable for integration tests with full Anchor framework
    
    #[test]
    fn test_multiplier_account_creation() {
        let multiplier_account = MultiplierAccount {
            new_multiplier: 100.0,
            multiplier_nonce: 0,
            new_multiplier_nonce: 1,
            activation_time: 1000,
        };
        
        assert_eq!(multiplier_account.new_multiplier, 100.0);
        assert_eq!(multiplier_account.multiplier_nonce, 0);
        assert_eq!(multiplier_account.new_multiplier_nonce, 1);
        assert_eq!(multiplier_account.activation_time, 1000);
    }

    #[test]
    fn test_multiplier_account_nonce_progression() {
        let mut multiplier_account = MultiplierAccount {
            new_multiplier: 50.0,
            multiplier_nonce: 5,
            new_multiplier_nonce: 6,
            activation_time: 2000,
        };
        
        // Simulate nonce progression
        multiplier_account.multiplier_nonce = multiplier_account.new_multiplier_nonce;
        multiplier_account.new_multiplier_nonce += 1;
        
        assert_eq!(multiplier_account.multiplier_nonce, 6);
        assert_eq!(multiplier_account.new_multiplier_nonce, 7);
    }
}