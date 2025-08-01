import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { MultiplierUpdater } from "../target/types/multiplier_updater";
import { getMint, getScaledUiAmountConfig } from "@solana/spl-token";
import { BN } from "bn.js";
import { createTestToken } from "./helpers/create-test-token";

describe("backed-solana-tokens", () => {
  const provider = anchor.AnchorProvider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MultiplierUpdater as Program<MultiplierUpdater>;

  it("Example run", async () => {
  
    // Create a test token with metadata
    const mintAddress = await createTestToken(wallet, program);
  
    await program.methods.initialize().accounts({
      user: wallet.publicKey,
    }).rpc();
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

    console.log(getScaledUiAmountConfig(mintData));
  });
});

