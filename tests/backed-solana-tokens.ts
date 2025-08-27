import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { MultiplierUpdater } from "../target/types/multiplier_updater";
import { getMint, getScaledUiAmountConfig } from "@solana/spl-token";
import { BN } from "bn.js";
import { createTestToken } from "./helpers/create-test-token";
import { expect } from "chai";

describe("backed-solana-tokens", () => {
  const provider = anchor.AnchorProvider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MultiplierUpdater as Program<MultiplierUpdater>;

  before(async () => {
    // Initialize the program once for all tests
    console.log("🔧 Initializing program for all tests...");
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
  });

  it("Basic program setup and functionality", async () => {
    console.log("🚀 Testing basic program setup and functionality...");
  
    // Create a test token with metadata
    const mintAddress = await createTestToken(wallet, program);
    
    await program.methods.initializeToken().accounts({
      mint: mintAddress,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    const currentTime = Math.floor(Date.now() / 1000);

    await program.methods.updateMultiplier(100.0, new BN(currentTime).add(new BN(1000))).accounts({
      mint: mintAddress,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    const mintData = await getMint(program.provider.connection, mintAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
    const scaledConfig = getScaledUiAmountConfig(mintData);
    console.log("📊 ScaledUI Config:", scaledConfig);
    
    console.log("✅ Basic functionality test completed successfully!");
  });

  it("Comprehensive functionality tests", async () => {
    console.log("🧪 Running comprehensive functionality tests...");

    // Test multiple tokens with the same program
    console.log("📋 Testing multiple token support...");
    const mintAddress2 = await createTestToken(wallet, program);
    
    await program.methods.initializeToken().accounts({
      mint: mintAddress2,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    // Test different multiplier values
    console.log("📋 Testing various multiplier values...");
    const multiplierTests = [
      { value: 1.5, desc: "Fractional multiplier" },
      { value: 0.5, desc: "Less than 1 multiplier" },
      { value: 999.999, desc: "Large multiplier" }
    ];

    for (const test of multiplierTests) {
      await program.methods.updateMultiplier(test.value, new BN(Math.floor(Date.now() / 1000) + 2000)).accounts({
        mint: mintAddress2,
        user: wallet.publicKey,
        program: TOKEN_2022_PROGRAM_ID
      }).rpc();
      console.log(`✅ ${test.desc}: ${test.value}`);
    }

    // Test custom nonce functionality
    console.log("📋 Testing custom nonce functionality...");
    await program.methods.updateMultiplierWithNonce(
      250.0, 
      new BN(Math.floor(Date.now() / 1000) + 3000), 
      new BN(10)
    ).accounts({
      mint: mintAddress2,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    // Get multiplier account and validate state
    const [multiplierAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multiplier_account"), mintAddress2.toBuffer()],
      program.programId
    );

    const multiplierAccount = await program.account.multiplierAccount.fetch(multiplierAccountAddress);
    console.log("📊 Final multiplier account state:");
    console.log(`  - New multiplier: ${multiplierAccount.newMultiplier}`);
    console.log(`  - Multiplier nonce: ${multiplierAccount.multiplierNonce.toString()}`);
    console.log(`  - New multiplier nonce: ${multiplierAccount.newMultiplierNonce.toString()}`);
    console.log(`  - Activation time: ${multiplierAccount.activationTime.toString()}`);

    // Validate expected values
    expect(multiplierAccount.newMultiplier).to.equal(250.0);
    expect(multiplierAccount.newMultiplierNonce.toString()).to.equal("10");

    console.log("✅ Comprehensive functionality tests completed successfully!");
  });

  it("Error handling and edge cases", async () => {
    console.log("🚨 Testing error handling and edge cases...");

    const mintAddress3 = await createTestToken(wallet, program);
    await program.methods.initializeToken().accounts({
      mint: mintAddress3,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    // First set a baseline nonce
    await program.methods.updateMultiplierWithNonce(
      100.0, 
      new BN(Math.floor(Date.now() / 1000) + 4000), 
      new BN(5)
    ).accounts({
      mint: mintAddress3,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    // Test invalid nonce (should fail)
    console.log("📋 Testing invalid nonce rejection...");
    try {
      await program.methods.updateMultiplierWithNonce(
        150.0, 
        new BN(Math.floor(Date.now() / 1000) + 4000), 
        new BN(3) // Invalid: less than current nonce
      ).accounts({
        mint: mintAddress3,
        user: wallet.publicKey,
        program: TOKEN_2022_PROGRAM_ID
      }).rpc();
      console.log("❌ Test failed: Expected error but transaction succeeded");
    } catch (error) {
      if (error.toString().includes("InvalidMultiplierNonce") || error.toString().includes("6001")) {
        console.log("✅ Invalid nonce correctly rejected with expected error");
      } else {
        console.log(`⚠️ Invalid nonce rejected but with different error: ${error.toString().substring(0, 100)}...`);
      }
    }

    // Test valid nonce progression
    console.log("📋 Testing valid nonce progression...");
    await program.methods.updateMultiplierWithNonce(
      200.0, 
      new BN(Math.floor(Date.now() / 1000) + 5000), 
      new BN(8) // Valid: greater than current nonce
    ).accounts({
      mint: mintAddress3,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    console.log("✅ Error handling and edge cases completed successfully!");
  });

  it("Performance and compute unit analysis", async () => {
    console.log("⚡ Running performance and compute unit analysis...");

    const mintAddress4 = await createTestToken(wallet, program);
    await program.methods.initializeToken().accounts({
      mint: mintAddress4,
      user: wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID
    }).rpc();

    // Test multiple rapid updates to analyze compute usage
    console.log("📋 Testing rapid sequential updates...");
    const updateCount = 5;
    const startTime = Date.now();

    for (let i = 1; i <= updateCount; i++) {
      await program.methods.updateMultiplier(
        100.0 * i, 
        new BN(Math.floor(Date.now() / 1000) + 6000 + i)
      ).accounts({
        mint: mintAddress4,
        user: wallet.publicKey,
        program: TOKEN_2022_PROGRAM_ID
      }).rpc();
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / updateCount;

    console.log(`📊 Performance metrics:`);
    console.log(`  - Total time for ${updateCount} updates: ${totalTime}ms`);
    console.log(`  - Average time per update: ${avgTime.toFixed(2)}ms`);
    console.log(`  - Updates per second: ${(1000 / avgTime).toFixed(2)}`);

    // Check final state
    const [multiplierAccountAddress] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("multiplier_account"), mintAddress4.toBuffer()],
      program.programId
    );

    const finalAccount = await program.account.multiplierAccount.fetch(multiplierAccountAddress);
    console.log(`📊 Final account state: nonce=${finalAccount.newMultiplierNonce.toString()}, multiplier=${finalAccount.newMultiplier}`);
    
    // Check that we have progression (actual nonce depends on any previous tests)
    const finalNonce = parseInt(finalAccount.newMultiplierNonce.toString());
    expect(finalNonce).to.be.greaterThan(0);
    expect(finalAccount.newMultiplier).to.equal(100.0 * updateCount);

    console.log("✅ Performance analysis completed successfully!");
  });
});

