const anchor = require("@project-serum/anchor");
const assert = require("assert");
const spl = require("@solana/spl-token");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

describe("super-token", () => {
  const provider = anchor.Provider.local();

  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const program = anchor.workspace.SuperToken;

  let mintUAccount = null;
  let tokenUWallet = null;
  let startUnixTime = null;
  let endUnixTime = null;

  it("Initializes test state", async () => {
    mintUAccount = await createMint(provider);
    tokenUWallet = await createTokenAccount(
      provider,
      mintUAccount.publicKey
    );
    const underlyingAmount = new anchor.BN(1001);
    await mintUAccount.mintTo(
      tokenUWallet,
      provider.wallet.publicKey,
      [],
      underlyingAmount.toString()
    );
    const startTime = new Date();
    startUnixTime = new anchor.BN(Math.floor(startTime.getTime() / 1000));
    const termDays = 120;
    let endTime = startTime;
    endTime.setDate(endTime.getDate() + termDays);
    endUnixTime = new anchor.BN(Math.floor(endTime.getTime() / 1000));
  });

  it("Creates a vault", async () => {
    const tokenUDeposits = anchor.web3.Keypair.generate();
    const mintYAccount = anchor.web3.Keypair.generate();
    const mintPAccount = anchor.web3.Keypair.generate();

    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );


    await program.rpc.createVault(bump, startUnixTime, endUnixTime, {
      accounts: {
        mintU: mintUAccount.publicKey,
        tokenU: tokenUDeposits.publicKey,
        mintY: mintYAccount.publicKey,
        mintP: mintPAccount.publicKey,
        vault: vaultAccount,
        payer: provider.wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        selfProg: program.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      },
      signers: [tokenUDeposits, mintPAccount, mintYAccount],
    });


    const vault = await program.account.saberVault.fetch(vaultAccount);

    assert.equal(vault.mintU.toBase58(), mintUAccount.publicKey.toBase58());

    assert.equal(vault.tokenU.toBase58(), tokenUDeposits.publicKey.toBase58());
    const tokenUAccountInfo = await getTokenAccount(provider, tokenUDeposits.publicKey);
    assert.equal(tokenUAccountInfo.mint.toBase58(), mintUAccount.publicKey.toBase58());

    assert.equal(vault.mintP.toBase58(), mintPAccount.publicKey.toBase58());
    assert.equal(vault.mintY.toBase58(), mintYAccount.publicKey.toBase58());

    const mintP = await provider.connection.getAccountInfo(
      mintPAccount.publicKey
    );
    const mintY = await provider.connection.getAccountInfo(
      mintYAccount.publicKey
    );
    const mintPAuth = spl.MintLayout.decode(mintP.data).mintAuthority;
    const mintYAuth = spl.MintLayout.decode(mintY.data).mintAuthority;
    assert.equal(vaultAccount.toBuffer().toString(), mintPAuth.toString());
    assert.equal(vaultAccount.toBuffer().toString(), mintYAuth.toString());

    assert.equal(vault.startTime.toString(), startUnixTime.toString());
    assert.equal(vault.endTime.toString(), endUnixTime.toString());
  });


  const tokenYAccount = anchor.web3.Keypair.generate();
  const tokenPAccount = anchor.web3.Keypair.generate();

  it("Initializes token accounts and mints tokens", async () => {

    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    await program.rpc.mintTo(bump, startUnixTime, endUnixTime, new anchor.BN(999), {
      accounts: {
        authority: provider.wallet.publicKey,
        vault: vaultAccount,
        tokenU: vault.tokenU,
        mintU: mintUAccount.publicKey,
        mintP: vault.mintP,
        mintY: vault.mintY,
        tokenUFrom: tokenUWallet,
        tokenP: tokenPAccount.publicKey,
        tokenY: tokenYAccount.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      },
      instructions: [
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: tokenPAccount.publicKey,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(165),
          space: 165,
          programId: TokenInstructions.TOKEN_PROGRAM_ID,
        }),
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: tokenYAccount.publicKey,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(165),
          space: 165,
          programId: TokenInstructions.TOKEN_PROGRAM_ID,
        }),
        TokenInstructions.initializeAccount({
          account: tokenPAccount.publicKey,
          mint: vault.mintP,
          owner: provider.wallet.publicKey,
        }),
        TokenInstructions.initializeAccount({
          account: tokenYAccount.publicKey,
          mint: vault.mintY,
          owner: provider.wallet.publicKey,
        }),
      ],
      signers: [tokenPAccount, tokenYAccount],
    });

    const tokenUAccountInfo = await getTokenAccount(provider, tokenUWallet);
    assert.ok(tokenUAccountInfo.amount.eq(new anchor.BN(2)));

    const vaultUAccountInfo = await getTokenAccount(provider, vault.tokenU);
    assert.ok(vaultUAccountInfo.amount.eq(new anchor.BN(999)));

    const tokenPAccountInfo = await getTokenAccount(provider, tokenPAccount.publicKey);
    assert.ok(tokenPAccountInfo.amount.eq(new anchor.BN(999)));

    const tokenYAccountInfo = await getTokenAccount(provider, tokenYAccount.publicKey);
    assert.ok(tokenYAccountInfo.amount.eq(new anchor.BN(999)));
  });

  it("Mints tokens on initialized token accounts", async () => {

    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    await program.rpc.mintTo(bump, startUnixTime, endUnixTime, new anchor.BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        vault: vaultAccount,
        tokenU: vault.tokenU,
        mintU: mintUAccount.publicKey,
        mintP: vault.mintP,
        mintY: vault.mintY,
        tokenUFrom: tokenUWallet,
        tokenP: tokenPAccount.publicKey,
        tokenY: tokenYAccount.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      },
    });

    const tokenUAccountInfo = await getTokenAccount(provider, tokenUWallet);
    assert.ok(tokenUAccountInfo.amount.eq(new anchor.BN(1)));

    const vaultUAccountInfo = await getTokenAccount(provider, vault.tokenU);
    assert.ok(vaultUAccountInfo.amount.eq(new anchor.BN(1000)));

    const tokenPAccountInfo = await getTokenAccount(provider, tokenPAccount.publicKey);
    assert.ok(tokenPAccountInfo.amount.eq(new anchor.BN(1000)));

    const tokenYAccountInfo = await getTokenAccount(provider, tokenYAccount.publicKey);
    assert.ok(tokenYAccountInfo.amount.eq(new anchor.BN(1000)));
  });

  it("Enforces sufficient funds", async () => {
    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    try {
      await program.rpc.mintTo(bump, startUnixTime, endUnixTime, new anchor.BN(1000), {
        accounts: {
          authority: provider.wallet.publicKey,
          vault: vaultAccount,
          tokenU: vault.tokenU,
          mintU: mintUAccount.publicKey,
          mintP: vault.mintP,
          mintY: vault.mintY,
          tokenUFrom: tokenUWallet,
          tokenP: tokenPAccount.publicKey,
          tokenY: tokenYAccount.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      assert.fail();
    } catch (e) {
      const msg = "Insufficient funds from underlying token account";
      assert.equal(msg, e.toString());
    }
  });

  it("Enforces valid vault account while minting", async () => {
    const [validVaultAccount, _bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      validVaultAccount
    );

    const [invalidVaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("invalid-seed"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );

    try {
      await program.rpc.mintTo(bump, startUnixTime, endUnixTime, new anchor.BN(1), {
        accounts: {
          authority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          vault: invalidVaultAccount,
          tokenU: vault.tokenU,
          mintU: mintUAccount.publicKey,
          mintP: vault.mintP,
          mintY: vault.mintY,
          tokenUFrom: tokenUWallet,
          tokenP: tokenPAccount.publicKey,
          tokenY: tokenYAccount.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      assert.fail();
    } catch (e) {
      const msg = "The given account is not owned by the executing program";
      assert.equal(msg, e.toString());
    }
  });

  it("Enforces valid seeds while minting", async () => {
    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    let invalidMintUAccount = await createMint(provider);

    try {
      await program.rpc.mintTo(bump, startUnixTime, endUnixTime, new anchor.BN(1), {
        accounts: {
          authority: provider.wallet.publicKey,
          vault: vaultAccount,
          tokenU: vault.tokenU,
          // Does not match the Vault's mintU PDA seed
          mintU: invalidMintUAccount.publicKey,
          mintP: vault.mintP,
          mintY: vault.mintY,
          tokenUFrom: tokenUWallet,
          tokenP: tokenPAccount.publicKey,
          tokenY: tokenYAccount.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      assert.fail();
    } catch (e) {
      const msg = "A seeds constraint was violated";
      assert.equal(msg, e.toString());
    }
  });

  it("Redeems tokens", async () => {
    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    await program.rpc.redeem(bump, startUnixTime, endUnixTime, new anchor.BN(999), {
      accounts: {
        authority: provider.wallet.publicKey,
        vault: vaultAccount,
        tokenU: vault.tokenU,
        mintU: vault.mintU,
        mintP: vault.mintP,
        mintY: vault.mintY,
        tokenUTo: tokenUWallet,
        tokenP: tokenPAccount.publicKey,
        tokenY: tokenYAccount.publicKey,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const tokenUAccountInfo = await getTokenAccount(provider, tokenUWallet);
    assert.ok(tokenUAccountInfo.amount.eq(new anchor.BN(1000)));

    const vaultUAccountInfo = await getTokenAccount(provider, vault.tokenU);
    assert.ok(vaultUAccountInfo.amount.eq(new anchor.BN(1)));

    const principalFrom = await getTokenAccount(provider, tokenPAccount.publicKey);
    assert.ok(principalFrom.amount.eq(new anchor.BN(1)));

    const yieldFrom = await getTokenAccount(provider, tokenYAccount.publicKey);
    assert.ok(yieldFrom.amount.eq(new anchor.BN(1)));
  });

  it("Enforces valid seeds while redeeming", async () => {
    const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      vaultAccount
    );

    let invalidMintUAccount = await createMint(provider);

    try {
      await program.rpc.redeem(bump, startUnixTime, endUnixTime, new anchor.BN(1), {
        accounts: {
          authority: provider.wallet.publicKey,
          vault: vaultAccount,
          tokenU: vault.tokenU,
          // Does not match the Vault's mintU PDA seed
          mintU: invalidMintUAccount.publicKey,
          mintP: vault.mintP,
          mintY: vault.mintY,
          tokenUTo: tokenUWallet,
          tokenP: tokenPAccount.publicKey,
          tokenY: tokenYAccount.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      assert.fail();
    } catch (e) {
      const msg = "A seeds constraint was violated";
      assert.equal(msg, e.toString());
    }
  });

  it("Enforces valid vault account while redeeming", async () => {
    const [validVaultAccount, _bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );
    const vault = await program.account.saberVault.fetch(
      validVaultAccount
    );

    const [invalidVaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("invalid-seed"),
        mintUAccount.publicKey.toBuffer(),
        anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
        anchor.utils.bytes.utf8.encode(endUnixTime.toString())
      ],
      program.programId
    );

    const tokenYAccount = anchor.web3.Keypair.generate();
    const tokenPAccount = anchor.web3.Keypair.generate();

    try {
      await program.rpc.redeem(bump, startUnixTime, endUnixTime, new anchor.BN(1), {
        accounts: {
          authority: provider.wallet.publicKey,
          vault: invalidVaultAccount,
          tokenU: vault.tokenU,
          mintU: vault.mintU,
          mintP: vault.mintP,
          mintY: vault.mintY,
          tokenUTo: tokenUWallet,
          tokenP: tokenPAccount.publicKey,
          tokenY: tokenYAccount.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      assert.fail();
    } catch (e) {
      const msg = "The given account is not owned by the executing program";
      assert.equal(msg, e.toString());
    }
  });
});

// SPL token client boilerplate for test initialization. Everything below here is
// mostly irrelevant to the point of the example.

const serumCmn = require("@project-serum/common");

// TODO: remove this constant once @project-serum/serum uses the same version
//       of @solana/web3.js as anchor (or switch packages).
const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
  TokenInstructions.TOKEN_PROGRAM_ID.toString()
);

async function getTokenAccount(provider, addr) {
  return await serumCmn.getTokenAccount(provider, addr);
}

async function createMint(provider) {
  const mint = await spl.Token.createMint(
    provider.connection,
    provider.wallet.payer,
    provider.wallet.publicKey,
    null,
    0,
    TOKEN_PROGRAM_ID
  );
  return mint;
}

async function createTokenAccount(provider, mint) {
  const token = new spl.Token(
    provider.connection,
    mint,
    TOKEN_PROGRAM_ID,
    provider.wallet.payer
  );
  let vault = await token.createAccount(provider.wallet.publicKey);
  return vault;
}
