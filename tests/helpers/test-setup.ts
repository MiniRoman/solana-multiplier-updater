import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { MultiplierUpdater } from "../../target/types/multiplier_updater";
import { createTestToken } from "./create-test-token";
import { BN } from "bn.js";
import { Keypair, PublicKey } from "@solana/web3.js";

export interface TestSetup {
  program: Program<MultiplierUpdater>;
  provider: anchor.AnchorProvider;
  wallet: anchor.Wallet;
  mintAddress: PublicKey;
  multiplierAccountAddress: PublicKey;
  programDataAddress: PublicKey;
}

/**
 * Common setup for multiplier updater tests
 */
export async function setupTest(): Promise<TestSetup> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MultiplierUpdater as Program<MultiplierUpdater>;
  
  // Create a test token with metadata and ScaledUI extension
  const mintAddress = await createTestToken(wallet, program);
  
  // Derive PDA addresses
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("program_data")],
    program.programId
  );
  
  const [multiplierAccountAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("multiplier_account"), mintAddress.toBuffer()],
    program.programId
  );
  
  return {
    program,
    provider,
    wallet,
    mintAddress,
    multiplierAccountAddress,
    programDataAddress,
  };
}

/**
 * Setup with unique program data account for isolated testing
 */
export async function setupTestIsolated(): Promise<TestSetup> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Create a unique keypair for this test to avoid conflicts
  const testKeypair = Keypair.generate();
  
  // Fund the test keypair
  const airdropTx = await provider.connection.requestAirdrop(
    testKeypair.publicKey,
    2 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(airdropTx);
  
  const testWallet = new anchor.Wallet(testKeypair);
  const testProvider = new anchor.AnchorProvider(
    provider.connection,
    testWallet,
    anchor.AnchorProvider.defaultOptions()
  );
  
  const program = new anchor.Program(
    anchor.workspace.MultiplierUpdater.idl,
    anchor.workspace.MultiplierUpdater.programId,
    testProvider
  ) as Program<MultiplierUpdater>;
  
  // Create a test token with metadata and ScaledUI extension
  const mintAddress = await createTestToken(testWallet, program);
  
  // Derive PDA addresses using a unique seed to avoid conflicts
  const uniqueSeed = testKeypair.publicKey.toBuffer().slice(0, 8);
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("program_data"), uniqueSeed],
    program.programId
  );
  
  const [multiplierAccountAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("multiplier_account"), mintAddress.toBuffer()],
    program.programId
  );
  
  return {
    program,
    provider: testProvider,
    wallet: testWallet,
    mintAddress,
    multiplierAccountAddress,
    programDataAddress,
  };
}

/**
 * Initialize the program (should be called once)
 */
export async function initializeProgram(setup: TestSetup): Promise<void> {
  await setup.program.methods
    .initialize()
    .accounts({
      user: setup.wallet.publicKey,
    })
    .rpc();
}

/**
 * Initialize a token's multiplier account
 */
export async function initializeTokenAccount(setup: TestSetup): Promise<void> {
  await setup.program.methods
    .initializeToken()
    .accounts({
      mint: setup.mintAddress,
      user: setup.wallet.publicKey,
      program: TOKEN_2022_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Get current timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get future timestamp by adding seconds
 */
export function getFutureTimestamp(secondsFromNow: number): number {
  return getCurrentTimestamp() + secondsFromNow;
}

/**
 * Create a BN from a number (useful for timestamps)
 */
export function toBN(value: number): BN {
  return new BN(value);
}

/**
 * Helper to create multiple test setups for parallel testing
 */
export async function setupMultipleTests(count: number): Promise<TestSetup[]> {
  const setups: TestSetup[] = [];
  
  for (let i = 0; i < count; i++) {
    const setup = await setupTest();
    setups.push(setup);
  }
  
  return setups;
}

/**
 * Wait for a specific number of seconds (useful for timing tests)
 */
export async function wait(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Create a random wallet for testing unauthorized access
 */
export function createRandomWallet(): Keypair {
  return Keypair.generate();
}

/**
 * Get account info safely (returns null if account doesn't exist)
 */
export async function getAccountSafely<T>(
  program: Program<MultiplierUpdater>,
  address: PublicKey,
  accountType: string
): Promise<T | null> {
  try {
    return await program.account[accountType].fetch(address) as T;
  } catch {
    return null;
  }
}