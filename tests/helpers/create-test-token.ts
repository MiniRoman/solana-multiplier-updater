import * as anchor from "@coral-xyz/anchor";
import { TYPE_SIZE, LENGTH_SIZE, getMintLen, ExtensionType, TOKEN_2022_PROGRAM_ID, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createInitializeScaledUiAmountConfigInstruction, tokenMetadataInitialize } from "@solana/spl-token";
import { TokenMetadata, pack } from "@solana/spl-token-metadata";
import { MultiplierUpdater } from "../../target/types/multiplier_updater";

export async function createTestToken(wallet: anchor.Wallet, program: anchor.Program<MultiplierUpdater>) {
  // Generate new keypair for Mint Account
  const mintKeypair = anchor.web3.Keypair.generate();
  // Address for Mint Account
  const mintAddress = mintKeypair.publicKey;
  // Metadata to store in Mint Account
  const metaData: TokenMetadata = {
    updateAuthority: wallet.publicKey,
    mint: mintAddress,
    name: "Test Token",
    symbol: "token",
    uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };
  // Size of MetadataExtension 2 bytes for type, 2 bytes for length
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  // Size of metadata
  const metadataLen = pack(metaData).length;

  // Size of Mint Account with extension
  const mintLen = getMintLen([ExtensionType.MetadataPointer, ExtensionType.ScaledUiAmountConfig]);
  // Minimum lamports required for Mint Account
  const lamports = await program.provider.connection.getMinimumBalanceForRentExemption(
    mintLen + metadataExtension + metadataLen
  );
  // Instruction to invoke System Program to create new account
  const createAccountInstruction = anchor.web3.SystemProgram.createAccount({
    fromPubkey: wallet.payer.publicKey, // Account that will transfer lamports to created account
    newAccountPubkey: mintAddress, // Address of the account to create
    space: mintLen, // Amount of bytes to allocate to the created account
    lamports, // Amount of lamports transferred to created account
    programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
  });
  const ix = createInitializeMetadataPointerInstruction(
    mintAddress,
    wallet.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  );
  // Instruction to initialize Mint Account data
  const initializeMintInstruction = createInitializeMintInstruction(
    mintAddress, // Mint Account Address
    6, // Decimals of Mint
    wallet.publicKey, // Designated Mint Authority
    null, // Optional Freeze Authority
    TOKEN_2022_PROGRAM_ID
  );
  const initializeScaledUiAmountConfigInstruction = createInitializeScaledUiAmountConfigInstruction(
    mintAddress,
    wallet.publicKey,
    1,
    TOKEN_2022_PROGRAM_ID
  );
  await program.provider.sendAndConfirm(
    new anchor.web3.Transaction().add(createAccountInstruction, ix, initializeScaledUiAmountConfigInstruction, initializeMintInstruction),
    [wallet.payer, mintKeypair],
    { skipPreflight: false, preflightCommitment: "confirmed" }
  );
  await tokenMetadataInitialize(
    program.provider.connection,
    wallet.payer,
    mintAddress,
    wallet.publicKey,
    wallet.publicKey,
    "Test Token",
    "token",
    "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json"
  )
  return mintAddress;
}
