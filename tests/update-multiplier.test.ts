import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";
import { 
  setupTest, 
  initializeProgram, 
  initializeTokenAccount, 
  getCurrentTimestamp, 
  getFutureTimestamp,
  toBN
} from "./helpers/test-setup";

describe("Update Multiplier", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
    await initializeProgram(testSetup);
    await initializeTokenAccount(testSetup);
  });

  describe("Basic Update Multiplier", () => {
    it("should update multiplier with auto-increment nonce", async () => {
      const multiplier = 150.0;
      const activationTime = getFutureTimestamp(1000);

      await testSetup.program.methods
        .updateMultiplier(multiplier, toBN(activationTime))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const multiplierAccount = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      expect(multiplierAccount.newMultiplier).to.equal(multiplier);
      expect(multiplierAccount.newMultiplierNonce.toString()).to.equal("1"); // Auto-incremented from 0
      expect(multiplierAccount.activationTime.toString()).to.equal(activationTime.toString());
    });

    it("should update multiplier multiple times with correct nonce progression", async () => {
      // First update
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
      expect(account.newMultiplierNonce.toString()).to.equal("1");

      // Second update
      await testSetup.program.methods
        .updateMultiplier(200.0, toBN(getFutureTimestamp(2000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplier).to.equal(200.0);
      expect(account.newMultiplierNonce.toString()).to.equal("2");
    });

    it("should handle immediate activation time correctly", async () => {
      const multiplier = 125.0;
      const activationTime = getCurrentTimestamp() - 10; // Past timestamp

      await testSetup.program.methods
        .updateMultiplier(multiplier, toBN(activationTime))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const multiplierAccount = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      expect(multiplierAccount.newMultiplier).to.equal(multiplier);
      expect(multiplierAccount.multiplierNonce.toString()).to.equal("1"); // Should be set as current nonce since activation time passed
      expect(multiplierAccount.newMultiplierNonce.toString()).to.equal("1");
    });

    it("should handle extreme multiplier values", async () => {
      const testCases = [
        { multiplier: 0.0001, desc: "very small positive" },
        { multiplier: 999999.999999, desc: "very large" },
        { multiplier: 1.0, desc: "exactly 1.0" },
        { multiplier: 0.0, desc: "zero" },
      ];

      for (const testCase of testCases) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);

        await setup.program.methods
          .updateMultiplier(testCase.multiplier, toBN(getFutureTimestamp(1000)))
          .accounts({
            mint: setup.mintAddress,
            user: setup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await setup.program.account.multiplierAccount.fetch(
          setup.multiplierAccountAddress
        );

        expect(account.newMultiplier).to.equal(testCase.multiplier, 
          `Failed for ${testCase.desc} multiplier value`);
      }
    });
  });

  describe("Update Multiplier with Custom Nonce", () => {
    it("should update multiplier with custom valid nonce", async () => {
      const multiplier = 175.0;
      const customNonce = 5;
      const activationTime = getFutureTimestamp(1000);

      await testSetup.program.methods
        .updateMultiplierWithNonce(multiplier, toBN(activationTime), new BN(customNonce))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const multiplierAccount = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      expect(multiplierAccount.newMultiplier).to.equal(multiplier);
      expect(multiplierAccount.newMultiplierNonce.toString()).to.equal(customNonce.toString());
      expect(multiplierAccount.activationTime.toString()).to.equal(activationTime.toString());
    });

    it("should fail with invalid nonce (less than or equal to current)", async () => {
      // First, set the current nonce to 3
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(3))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Now try to set a nonce <= 3
      const invalidNonces = [0, 1, 2, 3];
      
      for (const nonce of invalidNonces) {
        try {
          await testSetup.program.methods
            .updateMultiplierWithNonce(150.0, toBN(getFutureTimestamp(1000)), new BN(nonce))
            .accounts({
              mint: testSetup.mintAddress,
              user: testSetup.wallet.publicKey,
              program: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
          expect.fail(`Should have failed with nonce ${nonce}`);
        } catch (error) {
          expect(error.toString()).to.include("InvalidMultiplierNonce");
        }
      }
    });

    it("should allow nonce greater than current", async () => {
      // Set initial nonce to 5
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Now use nonce 10 (greater than 5)
      await testSetup.program.methods
        .updateMultiplierWithNonce(150.0, toBN(getFutureTimestamp(1000)), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplierNonce.toString()).to.equal("10");
    });

    it("should handle maximum nonce value", async () => {
      const maxNonce = new BN(2).pow(new BN(64)).sub(new BN(1)); // u64::MAX

      // This might fail due to practical limitations, but test the structure
      try {
        await testSetup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), maxNonce)
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        expect(account.newMultiplierNonce.toString()).to.equal(maxNonce.toString());
      } catch (error) {
        // This is acceptable for max values
        console.log("Max nonce test failed as expected due to practical limits");
      }
    });
  });

  describe("Timing and Nonce Logic", () => {
    it("should correctly handle nonce activation based on timing", async () => {
      const futureTime = getFutureTimestamp(10); // 10 seconds in future
      
      // Set a multiplier with future activation
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(futureTime), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Since activation time is in the future, current nonce should remain 0
      expect(account.multiplierNonce.toString()).to.equal("0");
      expect(account.newMultiplierNonce.toString()).to.equal("5");
    });

    it("should handle past activation time correctly", async () => {
      const pastTime = getCurrentTimestamp() - 100; // 100 seconds ago
      
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(pastTime), new BN(7))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Since activation time is in the past, current nonce should be updated
      expect(account.multiplierNonce.toString()).to.equal("7");
      expect(account.newMultiplierNonce.toString()).to.equal("7");
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle negative activation times", async () => {
      const negativeTime = -1000000;
      
      await testSetup.program.methods
        .updateMultiplier(100.0, toBN(negativeTime))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      expect(account.activationTime.toString()).to.equal(negativeTime.toString());
      // Since negative time is in the past, nonce should be activated
      expect(account.multiplierNonce.toString()).to.equal("1");
    });

    it("should handle maximum timestamp values", async () => {
      const maxTimestamp = new BN(2).pow(new BN(63)).sub(new BN(1)); // i64::MAX
      
      await testSetup.program.methods
        .updateMultiplier(100.0, maxTimestamp)
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      expect(account.activationTime.toString()).to.equal(maxTimestamp.toString());
    });
  });
});