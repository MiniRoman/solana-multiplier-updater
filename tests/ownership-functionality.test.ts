import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { MultiplierUpdater } from "../target/types/multiplier_updater";
import { createTestToken } from "./helpers/create-test-token";

// Helper function to create test token with specific authority
async function createTestTokenWithAuthority(authority: anchor.web3.Keypair, program: Program<MultiplierUpdater>) {
  const mintKeypair = anchor.web3.Keypair.generate();
  const mintAddress = mintKeypair.publicKey;
  
  const { TOKEN_2022_PROGRAM_ID, getMintLen, ExtensionType, 
          createInitializeMetadataPointerInstruction, 
          createInitializeMintInstruction, 
          createInitializeScaledUiAmountConfigInstruction } = await import("@solana/spl-token");

  const mintLen = getMintLen([ExtensionType.MetadataPointer, ExtensionType.ScaledUiAmountConfig]);
  const lamports = await program.provider.connection.getMinimumBalanceForRentExemption(mintLen + 64);

  const createAccountInstruction = anchor.web3.SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: mintAddress,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initMetadataPointer = createInitializeMetadataPointerInstruction(
    mintAddress,
    authority.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  );

  const initializeMintInstruction = createInitializeMintInstruction(
    mintAddress,
    6,
    authority.publicKey, // Authority as mint authority
    null,
    TOKEN_2022_PROGRAM_ID
  );

  const initializeScaledUiAmountConfigInstruction = createInitializeScaledUiAmountConfigInstruction(
    mintAddress,
    authority.publicKey, // Authority as ScaledUI authority
    1,
    TOKEN_2022_PROGRAM_ID
  );

  await program.provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      createAccountInstruction, 
      initMetadataPointer, 
      initializeScaledUiAmountConfigInstruction, 
      initializeMintInstruction
    ),
    [authority, mintKeypair],
    { skipPreflight: false, preflightCommitment: "confirmed" }
  );

  return mintAddress;
}
import { expect } from "chai";
import { BN } from "bn.js";

describe("Ownership Functionality Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MultiplierUpdater as Program<MultiplierUpdater>;
  
  // Generate a new keypair for the new owner
  const newOwner = anchor.web3.Keypair.generate();

  before(async () => {
    // Initialize the program if not already done
    console.log("🔧 Initializing program for ownership tests...");
    try {
      await program.methods.initialize().accounts({
        user: wallet.publicKey,
      }).rpc();
      console.log("✅ Program initialized successfully");
    } catch (error) {
      if (error.toString().includes("already in use")) {
        console.log("✅ Program already initialized");
      } else {
        throw error;
      }
    }

    // Fund the new owner account
    const signature = await provider.connection.requestAirdrop(
      newOwner.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  });

  it("Should transfer ownership successfully", async () => {
    console.log("🔐 Testing ownership transfer...");

    await program.methods.transferOwnership().accounts({
      currentOwner: wallet.publicKey,
      newOwner: newOwner.publicKey,
    }).rpc();

    // Verify ownership has changed
    const [programDataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("program_data")],
      program.programId
    );
    
    const programData = await program.account.programData.fetch(programDataAddress);
    expect(programData.owner.toString()).to.equal(newOwner.publicKey.toString());
    
    console.log("✅ Ownership transferred successfully");
  });

  it("Should reject unauthorized ownership transfer", async () => {
    console.log("🚨 Testing unauthorized ownership transfer...");

    const unauthorizedUser = anchor.web3.Keypair.generate();
    
    // Fund the unauthorized user
    const signature = await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    try {
      await program.methods.transferOwnership().accounts({
        currentOwner: unauthorizedUser.publicKey,
        newOwner: wallet.publicKey,
      }).signers([unauthorizedUser]).rpc();
      
      console.log("❌ Test failed: Expected error but transaction succeeded");
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error) {
      console.log("✅ Unauthorized ownership transfer correctly rejected");
      expect(error.toString()).to.include("constraint");
    }
  });

  it("Should allow data-only multiplier updates by owner", async () => {
    console.log("📊 Testing data-only multiplier update by owner...");

    const mintAddress = await createTestToken(wallet, program);
    
    // Initialize token with new owner
    await program.methods.initializeToken().accounts({
      mint: mintAddress,
      user: newOwner.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).signers([newOwner]).rpc();

    const currentTime = Math.floor(Date.now() / 1000);
    
    // Test data-only update
    await program.methods.updateMultiplierDataOnly(
      150.0, 
      new BN(currentTime + 2000), 
      new BN(1)
    ).accounts({
      mint: mintAddress,
      owner: newOwner.publicKey,
    }).signers([newOwner]).rpc();

    // Verify the multiplier account data was updated
    const [multiplierAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multiplier_account"), mintAddress.toBuffer()],
      program.programId
    );

    const multiplierAccount = await program.account.multiplierAccount.fetch(multiplierAccountAddress);
    expect(multiplierAccount.newMultiplier).to.equal(150.0);
    expect(multiplierAccount.newMultiplierNonce.toString()).to.equal("1");
    
    console.log("✅ Data-only multiplier update successful");
  });

  it("Should reject data-only multiplier updates by non-owner", async () => {
    console.log("🚨 Testing unauthorized data-only multiplier update...");

    const mintAddress = await createTestToken(wallet, program);
    
    // Initialize token with new owner
    await program.methods.initializeToken().accounts({
      mint: mintAddress,
      user: newOwner.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).signers([newOwner]).rpc();

    const currentTime = Math.floor(Date.now() / 1000);
    
    try {
      // Attempt update with original wallet (no longer owner)
      await program.methods.updateMultiplierDataOnly(
        200.0, 
        new BN(currentTime + 2000), 
        new BN(1)
      ).accounts({
        mint: mintAddress,
        owner: wallet.publicKey,
      }).rpc();
      
      console.log("❌ Test failed: Expected error but transaction succeeded");
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error) {
      console.log("✅ Unauthorized data-only update correctly rejected");
      expect(error.toString()).to.include("constraint");
    }
  });

  it("Should reject regular multiplier updates by non-owner", async () => {
    console.log("🚨 Testing unauthorized regular multiplier update...");

    const mintAddress = await createTestToken(wallet, program);
    
    // Initialize token with new owner
    await program.methods.initializeToken().accounts({
      mint: mintAddress,
      user: newOwner.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).signers([newOwner]).rpc();

    const currentTime = Math.floor(Date.now() / 1000);
    
    try {
      // Attempt update with original wallet (no longer owner)
      await program.methods.updateMultiplier(
        100.0, 
        new BN(currentTime + 1000)
      ).accounts({
        mint: mintAddress,
        user: wallet.publicKey,
        program: TOKEN_2022_PROGRAM_ID
      }).rpc();
      
      console.log("❌ Test failed: Expected error but transaction succeeded");
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error) {
      console.log("✅ Unauthorized regular update correctly rejected");
      expect(error.toString()).to.include("constraint");
    }
  });

  it("Should allow regular multiplier updates by owner", async () => {
    console.log("✅ Testing regular multiplier update by owner...");

    // Create token with new owner as the authority (needed for Token 2022 CPI)
    const mintAddress = await createTestTokenWithAuthority(newOwner, program);
    
    // Initialize token with new owner
    await program.methods.initializeToken().accounts({
      mint: mintAddress,
      user: newOwner.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).signers([newOwner]).rpc();

    const currentTime = Math.floor(Date.now() / 1000);
    
    // Test regular update by owner
    await program.methods.updateMultiplier(
      125.0, 
      new BN(currentTime + 1000)
    ).accounts({
      mint: mintAddress,
      user: newOwner.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).signers([newOwner]).rpc();

    // Verify the multiplier account data was updated
    const [multiplierAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multiplier_account"), mintAddress.toBuffer()],
      program.programId
    );

    const multiplierAccount = await program.account.multiplierAccount.fetch(multiplierAccountAddress);
    expect(multiplierAccount.newMultiplier).to.equal(125.0);
    
    console.log("✅ Regular multiplier update by owner successful");
  });

  after(async () => {
    // Transfer ownership back to original wallet for other tests
    console.log("🔄 Transferring ownership back to original wallet...");
    await program.methods.transferOwnership().accounts({
      currentOwner: newOwner.publicKey,
      newOwner: wallet.publicKey,
    }).signers([newOwner]).rpc();
    console.log("✅ Ownership restored");
  });
});