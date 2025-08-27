import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { setupTest, initializeProgram, initializeTokenAccount, createRandomWallet, getAccountSafely } from "./helpers/test-setup";

describe("Token Initialization", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
    // Initialize the program first
    await initializeProgram(testSetup);
  });

  it("should initialize token multiplier account successfully", async () => {
    await initializeTokenAccount(testSetup);

    // Fetch the multiplier account
    const multiplierAccount = await testSetup.program.account.multiplierAccount.fetch(
      testSetup.multiplierAccountAddress
    );

    // Check default values
    expect(multiplierAccount.newMultiplier).to.equal(0);
    expect(multiplierAccount.multiplierNonce.toString()).to.equal("0");
    expect(multiplierAccount.newMultiplierNonce.toString()).to.equal("0");
    expect(multiplierAccount.activationTime.toString()).to.equal("0");
  });

  it("should fail to initialize token account twice", async () => {
    // Initialize once
    await initializeTokenAccount(testSetup);

    // Try to initialize again - should fail
    try {
      await initializeTokenAccount(testSetup);
      expect.fail("Should have failed to initialize token account twice");
    } catch (error) {
      expect(error.toString()).to.include("already in use");
    }
  });

  it("should have correct multiplier account PDA derivation", async () => {
    const [expectedAddress, expectedBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multiplier_account"), testSetup.mintAddress.toBuffer()],
      testSetup.program.programId
    );

    expect(testSetup.multiplierAccountAddress.toString()).to.equal(expectedAddress.toString());
  });

  it("should fail if program data is not initialized first", async () => {
    // Create a new test setup without initializing program data
    const freshSetup = await setupTest();

    try {
      await freshSetup.program.methods
        .initializeToken()
        .accounts({
          mint: freshSetup.mintAddress,
          user: freshSetup.wallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Should have failed without program data initialization");
    } catch (error) {
      // Expected to fail because program_data account doesn't exist
      expect(error.toString()).to.include("AccountNotInitialized");
    }
  });

  it("should fail if non-owner tries to initialize token", async () => {
    const unauthorizedWallet = createRandomWallet();
    
    // Add some SOL to the unauthorized wallet
    const airdropTx = await testSetup.provider.connection.requestAirdrop(
      unauthorizedWallet.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await testSetup.provider.connection.confirmTransaction(airdropTx);

    // Create unauthorized provider
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
        .initializeToken()
        .accounts({
          mint: testSetup.mintAddress,
          user: unauthorizedWallet.publicKey,
          program: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
      expect.fail("Should have failed with unauthorized user");
    } catch (error) {
      // Should fail due to constraint: user.key() == program_data.owner
      expect(error.toString()).to.include("ConstraintRaw");
    }
  });

  it("should create multiplier account with correct space allocation", async () => {
    await initializeTokenAccount(testSetup);
    
    const accountInfo = await testSetup.provider.connection.getAccountInfo(
      testSetup.multiplierAccountAddress
    );

    // Account should exist
    expect(accountInfo).to.not.be.null;
    
    // Check account data size (8 bytes discriminator + 64 bytes for MultiplierAccount)
    expect(accountInfo!.data.length).to.equal(8 + 64);
    
    // Check account owner
    expect(accountInfo!.owner.toString()).to.equal(testSetup.program.programId.toString());
  });

  it("should handle different mint addresses correctly", async () => {
    // Create multiple test setups with different mints
    const setup1 = await setupTest();
    const setup2 = await setupTest();
    
    await initializeProgram(setup1);
    await initializeProgram(setup2);

    // Both should be able to initialize their respective token accounts
    await initializeTokenAccount(setup1);
    await initializeTokenAccount(setup2);

    // Fetch both accounts
    const account1 = await setup1.program.account.multiplierAccount.fetch(
      setup1.multiplierAccountAddress
    );
    const account2 = await setup2.program.account.multiplierAccount.fetch(
      setup2.multiplierAccountAddress
    );

    // Both should exist with default values
    expect(account1.newMultiplier).to.equal(0);
    expect(account2.newMultiplier).to.equal(0);
    
    // The addresses should be different
    expect(setup1.multiplierAccountAddress.toString()).to.not.equal(
      setup2.multiplierAccountAddress.toString()
    );
  });

  it("should handle token initialization before and after states", async () => {
    // Before initialization - account should not exist
    const accountBefore = await getAccountSafely(
      testSetup.program,
      testSetup.multiplierAccountAddress,
      "multiplierAccount"
    );
    expect(accountBefore).to.be.null;

    // Initialize
    await initializeTokenAccount(testSetup);

    // After initialization - account should exist
    const accountAfter = await getAccountSafely(
      testSetup.program,
      testSetup.multiplierAccountAddress,
      "multiplierAccount"
    );
    expect(accountAfter).to.not.be.null;
  });
});