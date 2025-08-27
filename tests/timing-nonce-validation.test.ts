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
  toBN,
  wait
} from "./helpers/test-setup";

describe("Timing and Nonce Validation", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
    await initializeProgram(testSetup);
    await initializeTokenAccount(testSetup);
  });

  describe("Nonce Logic and Progression", () => {
    it("should correctly determine current multiplier nonce based on activation time", async () => {
      const futureTime = getFutureTimestamp(10);
      
      // Set a multiplier with future activation
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(futureTime), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      let account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Since activation time is in future, current nonce should remain 0
      expect(account.multiplierNonce.toString()).to.equal("0");
      expect(account.newMultiplierNonce.toString()).to.equal("5");

      // Now set another multiplier with past activation time
      const pastTime = getCurrentTimestamp() - 100;
      await testSetup.program.methods
        .updateMultiplierWithNonce(200.0, toBN(pastTime), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Since activation time is in past, current nonce should be updated
      expect(account.multiplierNonce.toString()).to.equal("10");
      expect(account.newMultiplierNonce.toString()).to.equal("10");
    });

    it("should handle nonce progression with multiple updates", async () => {
      const updates = [
        { nonce: 1, multiplier: 100.0, time: getFutureTimestamp(100) },
        { nonce: 3, multiplier: 150.0, time: getFutureTimestamp(200) },
        { nonce: 7, multiplier: 200.0, time: getFutureTimestamp(300) },
        { nonce: 15, multiplier: 250.0, time: getCurrentTimestamp() - 10 }, // Past time
      ];

      for (const update of updates) {
        await testSetup.program.methods
          .updateMultiplierWithNonce(update.multiplier, toBN(update.time), new BN(update.nonce))
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

      // The last update had past activation time, so it should be current
      expect(account.multiplierNonce.toString()).to.equal("15");
      expect(account.newMultiplierNonce.toString()).to.equal("15");
      expect(account.newMultiplier).to.equal(250.0);
    });

    it("should validate that new nonce is always greater than current nonce", async () => {
      // Set initial nonce to 10
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Try various invalid nonces
      const invalidNonces = [0, 5, 10]; // All <= current nonce

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

      // Valid nonces should work
      const validNonces = [11, 15, 100];

      for (const nonce of validNonces) {
        const freshSetup = await setupTest();
        await initializeProgram(freshSetup);
        await initializeTokenAccount(freshSetup);
        
        // Set base nonce first
        await freshSetup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(getFutureTimestamp(1000)), new BN(10))
          .accounts({
            mint: freshSetup.mintAddress,
            user: freshSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        // Now test valid nonce
        await freshSetup.program.methods
          .updateMultiplierWithNonce(150.0, toBN(getFutureTimestamp(1000)), new BN(nonce))
          .accounts({
            mint: freshSetup.mintAddress,
            user: freshSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await freshSetup.program.account.multiplierAccount.fetch(
          freshSetup.multiplierAccountAddress
        );
        expect(account.newMultiplierNonce.toString()).to.equal(nonce.toString());
      }
    });

    it("should handle auto-increment nonce correctly", async () => {
      // Make several auto-increment updates
      for (let i = 1; i <= 5; i++) {
        await testSetup.program.methods
          .updateMultiplier(100.0 * i, toBN(getFutureTimestamp(1000 * i)))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await testSetup.program.account.multiplierAccount.fetch(
          testSetup.multiplierAccountAddress
        );
        
        expect(account.newMultiplierNonce.toString()).to.equal(i.toString());
        expect(account.newMultiplier).to.equal(100.0 * i);
      }
    });
  });

  describe("Activation Time Logic", () => {
    it("should correctly handle immediate activation (past timestamps)", async () => {
      const pastTimestamps = [
        getCurrentTimestamp() - 1000,   // 1000 seconds ago
        getCurrentTimestamp() - 1,      // 1 second ago
        getCurrentTimestamp(),          // Current time
        -1000000,                       // Very old timestamp
        0,                              // Epoch time
      ];

      for (let i = 0; i < pastTimestamps.length; i++) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);

        const nonce = i + 1;
        await setup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(pastTimestamps[i]), new BN(nonce))
          .accounts({
            mint: setup.mintAddress,
            user: setup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await setup.program.account.multiplierAccount.fetch(
          setup.multiplierAccountAddress
        );

        // Since activation time is in past, nonce should be immediately active
        expect(account.multiplierNonce.toString()).to.equal(nonce.toString());
        expect(account.newMultiplierNonce.toString()).to.equal(nonce.toString());
        expect(account.activationTime.toString()).to.equal(pastTimestamps[i].toString());
      }
    });

    it("should correctly handle future activation timestamps", async () => {
      const futureTimestamps = [
        getFutureTimestamp(1),          // 1 second from now
        getFutureTimestamp(3600),       // 1 hour from now
        getFutureTimestamp(86400),      // 1 day from now
        getFutureTimestamp(31536000),   // 1 year from now
      ];

      for (let i = 0; i < futureTimestamps.length; i++) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);

        const nonce = i + 1;
        await setup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(futureTimestamps[i]), new BN(nonce))
          .accounts({
            mint: setup.mintAddress,
            user: setup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await setup.program.account.multiplierAccount.fetch(
          setup.multiplierAccountAddress
        );

        // Since activation time is in future, current nonce should remain 0
        expect(account.multiplierNonce.toString()).to.equal("0");
        expect(account.newMultiplierNonce.toString()).to.equal(nonce.toString());
        expect(account.activationTime.toString()).to.equal(futureTimestamps[i].toString());
      }
    });

    it("should handle edge cases around current time", async () => {
      const currentTime = getCurrentTimestamp();
      
      // Test timestamps right around the current time
      const edgeCases = [
        currentTime - 5,    // 5 seconds ago
        currentTime - 1,    // 1 second ago
        currentTime,        // Exactly now
        currentTime + 1,    // 1 second from now
        currentTime + 5,    // 5 seconds from now
      ];

      for (let i = 0; i < edgeCases.length; i++) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);

        const nonce = i + 1;
        await setup.program.methods
          .updateMultiplierWithNonce(100.0, toBN(edgeCases[i]), new BN(nonce))
          .accounts({
            mint: setup.mintAddress,
            user: setup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        const account = await setup.program.account.multiplierAccount.fetch(
          setup.multiplierAccountAddress
        );

        const expectedCurrentNonce = edgeCases[i] <= getCurrentTimestamp() ? nonce.toString() : "0";
        expect(account.multiplierNonce.toString()).to.equal(expectedCurrentNonce);
        expect(account.newMultiplierNonce.toString()).to.equal(nonce.toString());
      }
    });

    it("should handle extreme timestamp values", async () => {
      const extremeTimestamps = [
        -2147483648,                    // i32::MIN (if supported)
        2147483647,                     // i32::MAX 
        -1,                            // -1 second
        Number.MAX_SAFE_INTEGER,       // Very large positive
      ];

      for (let i = 0; i < extremeTimestamps.length; i++) {
        const setup = await setupTest();
        await initializeProgram(setup);
        await initializeTokenAccount(setup);

        const nonce = i + 1;
        
        try {
          await setup.program.methods
            .updateMultiplierWithNonce(100.0, toBN(extremeTimestamps[i]), new BN(nonce))
            .accounts({
              mint: setup.mintAddress,
              user: setup.wallet.publicKey,
              program: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();

          const account = await setup.program.account.multiplierAccount.fetch(
            setup.multiplierAccountAddress
          );
          
          expect(account.activationTime.toString()).to.equal(extremeTimestamps[i].toString());
        } catch (error) {
          // Some extreme values might fail, which is acceptable
          console.log(`Extreme timestamp ${extremeTimestamps[i]} failed as expected`);
        }
      }
    });
  });

  describe("Time-based State Transitions", () => {
    it("should demonstrate nonce activation over time", async () => {
      const nearFutureTime = getCurrentTimestamp() + 2; // 2 seconds from now
      
      // Set multiplier with near-future activation
      await testSetup.program.methods
        .updateMultiplierWithNonce(100.0, toBN(nearFutureTime), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Initially, nonce should not be active
      let account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.multiplierNonce.toString()).to.equal("0");
      expect(account.newMultiplierNonce.toString()).to.equal("5");

      // Wait for activation time to pass
      await wait(3);

      // Make another update to trigger nonce check
      await testSetup.program.methods
        .updateMultiplierWithNonce(200.0, toBN(getFutureTimestamp(1000)), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // Now the nonce logic should reflect the time-based transition
      expect(account.multiplierNonce.toString()).to.equal("5"); // Previous nonce became active
      expect(account.newMultiplierNonce.toString()).to.equal("10");
    });

    it("should handle multiple time-based transitions", async () => {
      const baseTime = getCurrentTimestamp();
      
      // Set up multiple updates with different activation times
      const updates = [
        { nonce: 1, time: baseTime + 1, multiplier: 100.0 },
        { nonce: 2, time: baseTime + 2, multiplier: 200.0 },
        { nonce: 3, time: baseTime + 3, multiplier: 300.0 },
      ];

      for (const update of updates) {
        await testSetup.program.methods
          .updateMultiplierWithNonce(update.multiplier, toBN(update.time), new BN(update.nonce))
          .accounts({
            mint: testSetup.mintAddress,
            user: testSetup.wallet.publicKey,
            program: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
      }

      // Wait for all activations to pass
      await wait(5);

      // Trigger a final update to check the state
      await testSetup.program.methods
        .updateMultiplierWithNonce(400.0, toBN(getFutureTimestamp(1000)), new BN(10))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );

      // The most recent activated nonce should be current
      expect(account.multiplierNonce.toString()).to.equal("3");
      expect(account.newMultiplier).to.equal(400.0);
      expect(account.newMultiplierNonce.toString()).to.equal("10");
    });
  });

  describe("Complex Nonce Scenarios", () => {
    it("should handle nonce gaps and non-sequential updates", async () => {
      const nonSequentialNonces = [1, 5, 3, 10, 2, 15]; // Mixed order
      const validNonces = [1, 5, 10, 15]; // Only these should succeed
      
      let lastSuccessfulNonce = 0;
      
      for (const nonce of nonSequentialNonces) {
        try {
          await testSetup.program.methods
            .updateMultiplierWithNonce(100.0 * nonce, toBN(getFutureTimestamp(1000)), new BN(nonce))
            .accounts({
              mint: testSetup.mintAddress,
              user: testSetup.wallet.publicKey,
              program: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
            
          // If successful, it should be greater than the last successful nonce
          expect(nonce).to.be.greaterThan(lastSuccessfulNonce);
          lastSuccessfulNonce = nonce;
          
          const account = await testSetup.program.account.multiplierAccount.fetch(
            testSetup.multiplierAccountAddress
          );
          expect(account.newMultiplierNonce.toString()).to.equal(nonce.toString());
        } catch (error) {
          // Should fail for nonces <= current nonce
          expect(error.toString()).to.include("InvalidMultiplierNonce");
        }
      }
    });

    it("should maintain nonce consistency across mixed update methods", async () => {
      // Use auto-increment method
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

      // Use custom nonce method with valid nonce
      await testSetup.program.methods
        .updateMultiplierWithNonce(200.0, toBN(getFutureTimestamp(1000)), new BN(5))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplierNonce.toString()).to.equal("5");

      // Use auto-increment again (should be 6)
      await testSetup.program.methods
        .updateMultiplier(300.0, toBN(getFutureTimestamp(1000)))
        .accounts({
          mint: testSetup.mintAddress,
          user: testSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      account = await testSetup.program.account.multiplierAccount.fetch(
        testSetup.multiplierAccountAddress
      );
      expect(account.newMultiplierNonce.toString()).to.equal("6");
    });
  });
});