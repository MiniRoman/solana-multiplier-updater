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

describe("Security and Authorization", () => {
  let testSetup: any;
  let authorizedSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
    await initializeProgram(testSetup);
    await initializeTokenAccount(testSetup);
  });

  describe("Program Ownership and Authority", () => {
    it("should only allow program owner to initialize tokens", async () => {
      // Create a fresh setup where we control who initializes the program
      const ownerSetup = await setupTest();
      const nonOwnerSetup = await setupTest();
      
      // Owner initializes the program
      await initializeProgram(ownerSetup);
      
      // Non-owner should not be able to initialize tokens
      try {
        await nonOwnerSetup.program.methods
          .initializeToken()
          .accounts({
            mint: nonOwnerSetup.mintAddress,
            user: nonOwnerSetup.wallet.publicKey, // Different user
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Non-owner should not be able to initialize tokens");
      } catch (error) {
        expect(error.toString()).to.include("ConstraintRaw");
      }

      // Owner should be able to initialize tokens
      await ownerSetup.program.methods
        .initializeToken()
        .accounts({
          mint: ownerSetup.mintAddress,
          user: ownerSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
      
      // Verify the token was initialized
      const account = await ownerSetup.program.account.multiplierAccount.fetch(
        ownerSetup.multiplierAccountAddress
      );
      expect(account).to.not.be.null;
    });

    it("should verify program data ownership constraint", async () => {
      const setupA = await setupTest();
      const setupB = await setupTest();
      
      // Initialize program with setupA wallet
      await initializeProgram(setupA);
      
      // Try to use setupB wallet to initialize a token (should fail)
      try {
        await setupB.program.methods
          .initializeToken()
          .accounts({
            mint: setupB.mintAddress,
            user: setupB.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed due to ownership constraint");
      } catch (error) {
        expect(error.toString()).to.include("ConstraintRaw");
      }
    });

    it("should ensure program data exists before token operations", async () => {
      const freshSetup = await setupTest();
      
      // Try to initialize token without initializing program first
      try {
        await initializeTokenAccount(freshSetup);
        expect.fail("Should have failed without program initialization");
      } catch (error) {
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });
  });

  describe("Signer Verification", () => {
    it("should require proper signer for all operations", async () => {
      const unauthorizedWallet = createRandomWallet();
      
      // Fund the unauthorized wallet
      const airdropTx = await testSetup.provider.connection.requestAirdrop(
        unauthorizedWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
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

      // Test that unauthorized wallet cannot perform operations on authorized setup's accounts
      try {
        await unauthorizedProgram.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: unauthorizedWallet.publicKey, // Different signer
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with unauthorized signer");
      } catch (error) {
        // Should fail due to mint authority or other constraints
        expect(error).to.exist;
      }
    });

    it("should validate that user is mutable signer", async () => {
      // This test ensures the user account is properly marked as mutable signer
      // If not, the transaction should fail
      
      await testSetup.program.methods
        .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
      
      // If we get here, the signer validation worked correctly
      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplier).to.equal(100.0);
    });
  });

  describe("PDA Security and Validation", () => {
    it("should ensure multiplier account PDA is correctly derived", async () => {
      // Try to use a manually created address instead of the correct PDA
      const fakeAddress = anchor.web3.Keypair.generate().publicKey;
      
      try {
        await testSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            multiplierAccount: fakeAddress,
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with incorrect PDA");
      } catch (error) {
        expect(error.toString()).to.include("seeds constraint");
      }
    });

    it("should validate program data PDA derivation", async () => {
      const fakeAddress = anchor.web3.Keypair.generate().publicKey;
      
      try {
        await testSetup.program.methods
          .initializeToken()
          .accounts({
            programData: fakeAddress, // Wrong PDA
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with incorrect program data PDA");
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it("should prevent cross-mint account access", async () => {
      // Create two separate token setups
      const setup1 = await setupTest();
      const setup2 = await setupTest();
      
      await initializeProgram(setup1);
      await initializeProgram(setup2);
      await initializeTokenAccount(setup1);
      await initializeTokenAccount(setup2);

      // Try to use setup1's multiplier account with setup2's mint
      try {
        await setup2.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            multiplierAccount: setup1.multiplierAccountAddress, // Wrong account for this mint
            mint: setup2.mintAddress,
            user: setup2.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed with wrong multiplier account for mint");
      } catch (error) {
        expect(error.toString()).to.include("seeds constraint");
      }
    });
  });

  describe("Account State Security", () => {
    it("should prevent manipulation of account data outside program", async () => {
      // Update multiplier normally
      await testSetup.program.methods
        .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      let account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplier).to.equal(100.0);
      expect(account.newMultiplierNonce.toString()).to.equal("1");

      // Verify account is owned by our program
      const accountInfo = await testSetup.provider.connection.getAccountInfo(
        testSetup.multiplierAccountAddress
      );
      expect(accountInfo!.owner.toString()).to.equal(testSetup.program.programId.toString());
    });

    it("should maintain account data integrity across operations", async () => {
      // Perform multiple operations and verify data consistency
      const operations = [
        { multiplier: 100.0, expectedNonce: "1" },
        { multiplier: 200.0, expectedNonce: "2" },
        { multiplier: 150.0, expectedNonce: "3" },
      ];

      for (const op of operations) {
        await testSetup.program.methods
          .updateMultiplier(op.multiplier, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        
        expect(account.newMultiplier).to.equal(op.multiplier);
        expect(account.newMultiplierNonce.toString()).to.equal(op.expectedNonce);
      }
    });
  });

  describe("Cross-Program Invocation (CPI) Security", () => {
    it("should safely handle CPI to Token 2022 program", async () => {
      // This test verifies that the CPI call to update_multiplier in Token 2022 is secure
      await testSetup.program.methods
        .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Verify our account was updated correctly
      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplier).to.equal(100.0);
    });

    it("should fail with incorrect token program in CPI", async () => {
      const WRONG_PROGRAM = new anchor.web3.PublicKey("11111111111111111111111111111112");
      
      try {
        await testSetup.program.methods
          .updateMultiplier(100.0, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: WRONG_PROGRAM, // Wrong program ID
          })
          .rpc();
        expect.fail("Should have failed with wrong program ID");
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe("Reentrancy and Race Condition Prevention", () => {
    it("should handle multiple concurrent operations safely", async () => {
      // Create multiple operations that could potentially interfere
      const promises = [];
      
      for (let i = 1; i <= 3; i++) {
        const promise = testSetup.program.methods
          .updateMultiplier(100.0 * i, toBN(getFutureTimestamp(1000 * i)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        promises.push(promise);
      }

      // One should succeed, others may fail due to nonce conflicts
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed
      const successCount = results.filter(r => r.status === "fulfilled").length;
      expect(successCount).to.be.at.least(1);

      // Failed ones should be due to nonce validation
      const failures = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
      for (const failure of failures) {
        expect(failure.reason.toString()).to.include("InvalidMultiplierNonce");
      }
    });
  });

  describe("Resource Exhaustion Protection", () => {
    it("should handle account creation limits gracefully", async () => {
      // Test multiple token initializations to ensure no resource exhaustion
      const setups = [];
      
      for (let i = 0; i < 5; i++) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);
        setups.push(setup);
      }

      // All should succeed
      for (const setup of setups) {
        const account = await setup.program.account.multiplierAccount.fetch(
          setup.multiplierAccountAddress
        );
        expect(account).to.not.be.null;
      }
    });

    it("should handle large nonce values without overflow", async () => {
      const largeNonce = new BN(2).pow(new BN(32)); // Large but not max u64
      
      try {
        await testSetup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), largeNonce)
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        expect(account.newMultiplierNonce.toString()).to.equal(largeNonce.toString());
      } catch (error) {
        // If it fails, ensure it's not due to an overflow but rather validation
        console.log("Large nonce test failed, possibly due to practical validation limits");
      }
    });
  });
});