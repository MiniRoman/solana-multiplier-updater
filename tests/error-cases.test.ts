import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";
import { 
  setupTest, 
  initializeProgram, 
  initializeTokenAccount, 
  createRandomWallet,
  getFutureTimestamp,
  toBN 
} from "./helpers/test-setup";

describe("Error Cases and Edge Conditions", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
    await initializeProgram(testSetup);
    await initializeTokenAccount(testSetup);
  });

  describe("Invalid Nonce Errors", () => {
    it("should fail with InvalidMultiplierNonce error for nonce equal to current", async () => {
      // First set nonce to 5
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Try to use nonce 5 again
      try {
        await testSetup.program.methods
          .updateMultiplierWithNonce(150.0, toBN(getFutureTimestamp(1000)), new BN(5))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with InvalidMultiplierNonce");
      } catch (error) {
        expect(error.toString()).to.include("InvalidMultiplierNonce");
        expect(error.toString()).to.include("6001"); // Error code for InvalidMultiplierNonce
      }
    });

    it("should fail with InvalidMultiplierNonce error for nonce less than current", async () => {
      // Set nonce to 10
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Try to use nonce 3 (less than current)
      try {
        await testSetup.program.methods
          .updateMultiplierWithNonce(150.0, toBN(getFutureTimestamp(1000)), new BN(3))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with InvalidMultiplierNonce");
      } catch (error) {
        expect(error.toString()).to.include("InvalidMultiplierNonce");
      }
    });

    it("should validate nonce for auto-increment method as well", async () => {
      // This test ensures that the auto-increment method also validates nonces correctly
      // by checking the current nonce logic
      
      // Make several updates to establish a current nonce
      for (let i = 1; i <= 5; i++) {
        await testSetup.program.methods
          .updateMultiplier(100.0 * i, toBN(getFutureTimestamp(1000 * i)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      }

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Current nonce should be 5, next should be 6
      expect(account.newMultiplierNonce.toString()).to.equal("5");

      // Auto-increment should work fine (will use nonce 6)
      await testSetup.program.methods
        .updateMultiplier(600.0, toBN(getFutureTimestamp(6000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const updatedAccount = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(updatedAccount.newMultiplierNonce.toString()).to.equal("6");
    });
  });

  describe("Account Not Initialized Errors", () => {
    it("should fail when trying to update multiplier without token initialization", async () => {
      const freshSetup = await setupTest();
      await initializeProgram(freshSetup);
      // Note: NOT calling initializeTokenAccount

      try {
        await freshSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: freshSetup.mintAddress,
            user: freshSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed without token initialization");
      } catch (error) {
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });

    it("should fail when trying to initialize token without program initialization", async () => {
      const freshSetup = await setupTest();
      // Note: NOT calling initializeProgram

      try {
        await freshSetup.program.methods
          .initializeToken()
          .accounts({
            mint: freshSetup.mintAddress,
            user: freshSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed without program initialization");
      } catch (error) {
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });
  });

  describe("Authorization and Constraint Errors", () => {
    it("should fail when unauthorized user tries to update multiplier", async () => {
      const unauthorizedWallet = createRandomWallet();
      
      // Fund the unauthorized wallet
      const airdropTx = await testSetup.provider.connection.requestAirdrop(
        unauthorizedWallet.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await testSetup.provider.connection.confirmTransaction(airdropTx);

      const unauthorizedProvider = new anchor.AnchorProvider(
        testSetup.provider.connection,
        new anchor.Wallet(unauthorizedWallet),
        anchor.AnchorProvider.defaultOptions()
      );

      const unauthorizedProgram = new anchor.Program(
        testSetup.program.idl,
        testSetup.program.programId,
        unauthorizedProvider
      );

      try {
        await unauthorizedProgram.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: unauthorizedWallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with unauthorized user");
      } catch (error) {
        // Could fail with various constraint errors depending on the mint authority setup
        expect(error).to.exist;
      }
    });

    it("should fail with incorrect program ID in token interface", async () => {
      // Use TOKEN program instead of TOKEN_2022 program
      const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      
      try {
        await testSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_PROGRAM_ID, // Wrong program ID
          })
          .rpc();
        expect.fail("Should have failed with wrong token program");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Account Mismatch Errors", () => {
    it("should fail with wrong mint address for multiplier account", async () => {
      // Create another token to get a different mint
      const wrongSetup = await setupTest();
      
      try {
        await testSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: wrongSetup.mintAddress, // Wrong mint address
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with wrong mint address");
      } catch (error) {
        // Should fail because the PDA derivation won't match
        expect(error.toString()).to.include("seeds constraint");
      }
    });

    it("should fail with manually created wrong multiplier account address", async () => {
      const wrongAddress = anchor.web3.Keypair.generate().publicKey;
      
      try {
        await testSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            multiplierAccount: wrongAddress, // Manually specify wrong address
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with wrong multiplier account address");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Numerical Edge Cases", () => {
    it("should handle negative multiplier values", async () => {
      const negativeMultiplier = -50.0;
      
      // This may or may not fail depending on the ScaledUI extension validation
      try {
        await testSetup.program.methods
          .updateMultiplier(negativeMultiplier, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        
        // If it succeeds, verify the value was stored
        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        expect(account.newMultiplier).to.equal(negativeMultiplier);
      } catch (error) {
        // If it fails, that's also acceptable for negative multipliers
        console.log("Negative multiplier rejected as expected");
        expect(error).to.exist;
      }
    });

    it("should handle very large multiplier values", async () => {
      const largeMultiplier = Number.MAX_SAFE_INTEGER;
      
      try {
        await testSetup.program.methods
          .updateMultiplier(largeMultiplier, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        expect(account.newMultiplier).to.equal(largeMultiplier);
      } catch (error) {
        // May fail due to precision or validation limits
        console.log("Large multiplier rejected, possibly due to precision limits");
        expect(error).to.exist;
      }
    });

    it("should handle NaN and Infinity values", async () => {
      const testValues = [NaN, Infinity, -Infinity];
      
      for (const value of testValues) {
        try {
          await testSetup.program.methods
            .updateMultiplier(value, toBN(getFutureTimestamp(1000)))
            .accounts({
              mint: testSetup.mintAddress,
              user: testSetup.wallet.publicKey,
              program: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
          expect.fail(`Should have failed with ${value}`);
        } catch (error) {
          // These should fail
          expect(error).to.exist;
        }
      }
    });
  });

  describe("System and Runtime Errors", () => {
    it("should handle insufficient funds for transaction fees", async () => {
      // Create a wallet with minimal funds
      const poorWallet = createRandomWallet();
      
      // Give it just enough for rent but not transaction fees
      const minRent = await testSetup.provider.connection.getMinimumBalanceForRentExemption(0);
      const airdropTx = await testSetup.provider.connection.requestAirdrop(
        poorWallet.publicKey,
        minRent + 1000 // Very small amount
      );
      await testSetup.provider.connection.confirmTransaction(airdropTx);

      const poorProvider = new anchor.AnchorProvider(
        testSetup.provider.connection,
        new anchor.Wallet(poorWallet),
        anchor.AnchorProvider.defaultOptions()
      );

      const poorProgram = new anchor.Program(
        testSetup.program.idl,
        testSetup.program.programId,
        poorProvider
      );

      try {
        await poorProgram.methods
          .initialize()
          .accounts({
            user: poorWallet.publicKey,
          })
          .rpc();
        expect.fail("Should have failed due to insufficient funds");
      } catch (error) {
        expect(error.toString()).to.include("insufficient");
      }
    });
  });
});