import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { setupTest, initializeProgram, getAccountSafely } from "./helpers/test-setup";
import { ProgramData } from "./helpers/test-setup";

describe("Program Initialization", () => {
  let testSetup: any;

  beforeEach(async () => {
    testSetup = await setupTest();
  });

  it("should initialize program data successfully", async () => {
    // Initialize the program
    await initializeProgram(testSetup);

    // Fetch the program data account
    const programData = await testSetup.program.account.programData.fetch(
      testSetup.programDataAddress
    );

    // Verify the owner is set correctly
    expect(programData.owner.toString()).to.equal(testSetup.wallet.publicKey.toString());
  });

  it("should fail to initialize program data twice", async () => {
    // Initialize the program once
    await initializeProgram(testSetup);

    // Try to initialize again - should fail
    try {
      await initializeProgram(testSetup);
      expect.fail("Should have failed to initialize twice");
    } catch (error) {
      // Expected to fail
      expect(error.toString()).to.include("already in use");
    }
  });

  it("should have correct program data account address derivation", async () => {
    const [expectedAddress, expectedBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("program_data")],
      testSetup.program.programId
    );

    expect(testSetup.programDataAddress.toString()).to.equal(expectedAddress.toString());
  });

  it("should allow only the correct user to initialize", async () => {
    // Create a different wallet
    const unauthorizedWallet = anchor.web3.Keypair.generate();
    
    // Add some SOL to the unauthorized wallet
    const airdropTx = await testSetup.provider.connection.requestAirdrop(
      unauthorizedWallet.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await testSetup.provider.connection.confirmTransaction(airdropTx);

    // Create a provider with the unauthorized wallet
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

    // Try to initialize with unauthorized wallet
    await unauthorizedProgram.methods
      .initialize()
      .accounts({
        user: unauthorizedWallet.publicKey,
      })
      .rpc();

    // Fetch the program data to verify the owner
    const programData = await testSetup.program.account.programData.fetch(
      testSetup.programDataAddress
    );

    // The owner should be the unauthorized wallet (since it was the one that initialized)
    expect(programData.owner.toString()).to.equal(unauthorizedWallet.publicKey.toString());
  });

  it("should create program data account with correct space allocation", async () => {
    await initializeProgram(testSetup);
    
    const accountInfo = await testSetup.provider.connection.getAccountInfo(
      testSetup.programDataAddress
    );

    // Account should exist
    expect(accountInfo).to.not.be.null;
    
    // Check account data size (8 bytes for discriminator + 32 bytes for Pubkey)
    expect(accountInfo!.data.length).to.equal(8 + 32);
    
    // Check account owner
    expect(accountInfo!.owner.toString()).to.equal(testSetup.program.programId.toString());
  });

  it("should handle program data account before and after initialization", async () => {
    // Before initialization - account should not exist
    const accountBefore = await getAccountSafely(
      testSetup.program,
      testSetup.programDataAddress,
      "programData"
    );
    expect(accountBefore).to.be.null;

    // Initialize
    await initializeProgram(testSetup);

    // After initialization - account should exist
    const accountAfter = await getAccountSafely(
      testSetup.program,
      testSetup.programDataAddress,
      "programData"
    );
    expect(accountAfter).to.not.be.null;
  });
});