const anchor = require('@project-serum/anchor');
const token = require("@solana/spl-token");
const tokenSwap = require("@solana/spl-token-swap");
const path = require("path");
const yargs = require('yargs');

// Configure the local cluster.
const provider = anchor.Provider.local('https://api.devnet.solana.com');
anchor.setProvider(provider);

yargs
  .scriptName("super-token")
  .usage('$0 <cmd> <args>')
  .command(
    'create-vault <mint> <start> <end>',
    'Creates a new superposition vault',
    (yargs) => {
      yargs.positional('mint', {
        type: 'string',
        describe: 'The mint address for the underlying asset'
      }),
      yargs.positional('start', {
        type: 'string',
        describe: 'The start date vault'
      }),
      yargs.positional('end', {
        type: 'string',
        describe: 'The end date vault'
      })
    },
    function (argv) {
      createVault(argv.mint, argv.start, argv.end).then(
        () => console.log('Vault created successfully!'));
    }
  )
  .command(
    'mint <mint> <start> <end> <amount>',
    'Mints superposition tokens from selected vault',
    (yargs) => {
      yargs.positional('mint', {
        type: 'string',
        describe: 'The mint address for the underlying asset'
      }),
      yargs.positional('start', {
        type: 'string',
        describe: 'The start date vault'
      }),
      yargs.positional('end', {
        type: 'string',
        describe: 'The end date vault'
      }),
      yargs.positional('amount', {
        type: 'number',
        describe: 'The amount to mint'
      })
    },
    function (argv) {
      mint(argv.mint, argv.start, argv.end, argv.amount).then(
        () => console.log('Superposition tokens minted successfully!'));
    }
  )
  .command(
    'redeem <mint> <start> <end> <amount>',
    'Redeems superposition tokens on selected vault',
    (yargs) => {
      yargs.positional('mint', {
        type: 'string',
        describe: 'The mint address for the underlying asset'
      }),
      yargs.positional('start', {
        type: 'string',
        describe: 'The start date vault'
      }),
      yargs.positional('end', {
        type: 'string',
        describe: 'The end date vault'
      }),
      yargs.positional('amount', {
        type: 'number',
        describe: 'The amount to redeem'
      })
    },
    function (argv) {
      redeem(argv.mint, argv.start, argv.end, argv.amount).then(
        () => console.log('Superposition tokens redeemed successfully!'));
    }
  )
  .command(
    'create-liquidity-pool <mintA> <mintB>',
    'Creates a liquidity pool for swapping mintA and mintB tokens',
    (yargs) => {
      yargs.positional('mintA', {
        type: 'string',
        describe: 'The mint address of one of the tokens in this liquidity pool'
      }),
      yargs.positional('mintB', {
        type: 'string',
        describe: 'The mint address of one of the tokens in this liquidity pool'
      })
    },
    function (argv) {
      createLiquidityPool(argv.mintA, argv.mintB).then(
        () => console.log('Swap pool created successfully!'));
    }
  )
  .command(
    'swap <liquidityPool> <fromMint> <amount>',
    'Swaps tokens using a liquidity pool',
    (yargs) => {
      yargs.positional('liquidityPool', {
        type: 'string',
        describe: 'The address of the liquidity pool'
      }),
      yargs.positional('fromMint', {
        type: 'string',
        describe: 'The mint of the tokens to be swapped from'
      }),
      yargs.positional('amount', {
        type: 'number',
        describe: 'The amount of tokens to be swapped'
      })
    },
    function (argv) {
      swap(argv.liquidityPool, argv.fromMint, argv.amount).then(
        () => console.log('Swapped successfully!'));
    }
  )
  .command(
    'deposit <liquidityPool> <amount>',
    'Deposit tokens to a liquidity pool',
    (yargs) => {
      yargs.positional('liquidityPool', {
        type: 'string',
        describe: 'The address of the liquidity pool'
      }),
      yargs.positional('mint', {
        type: 'string',
        describe: 'The mint of the tokens to be deposited'
      }),
      yargs.positional('amount', {
        type: 'number',
        describe: 'The amount of tokens to be swapped'
      })
    },
    function (argv) {
      deposit(argv.liquidityPool, argv.amount).then(
        () => console.log('Deposited successfully!'));
    }
  )
  .demandCommand()
  .recommendCommands()
  .strict()
  .help()
  .argv

function getProgram() {
  // Read the generated IDL.
  const idlPath = path.resolve(__dirname, 'super_token.json');
  const idl = JSON.parse(require('fs').readFileSync(idlPath, 'utf8'));

  const programId = idl.metadata.address;
  // Generate the program client from IDL.
  return new anchor.Program(idl, programId);
}

// Creates a superposition vault
async function createVault(mintUAccount, startDate, endDate) {
  console.log('Creating vault for mint ' + mintUAccount +
      ' from ' + startDate + ' to ' + endDate);

  const mintUKey = new anchor.web3.PublicKey(mintUAccount);

  const startTime = new Date(startDate);
  const startUnixTime = new anchor.BN(Math.floor(startTime.getTime() / 1000));
  const endTime = new Date(endDate);
  const endUnixTime = new anchor.BN(Math.floor(endTime.getTime() / 1000));

  // Generate the program client from IDL.
  const program = getProgram();

  const mintYAccount = anchor.web3.Keypair.generate();
  const mintPAccount = anchor.web3.Keypair.generate();
  const tokenUDeposits = anchor.web3.Keypair.generate();

  const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("vault"),
      mintUKey.toBuffer(),
      anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
      anchor.utils.bytes.utf8.encode(endUnixTime.toString())
    ],
    program.programId
  );

  await program.rpc.createVault(bump, startUnixTime, endUnixTime, {
    accounts: {
      tokenU: tokenUDeposits.publicKey,
      mintU: mintUKey,
      mintY: mintYAccount.publicKey,
      mintP: mintPAccount.publicKey,
      vault: vaultAccount,
      payer: provider.wallet.publicKey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: token.TOKEN_PROGRAM_ID
    },
    signers: [tokenUDeposits, mintPAccount, mintYAccount],
  });
  console.log("Created vault: " + vaultAccount.toString());
  console.log("Principal mint: " + mintPAccount.publicKey.toString());
  console.log("Yield mint: " + mintYAccount.publicKey.toString());
  console.log("Underlying asset account: " + tokenUDeposits.publicKey.toString());
}

// Mints tokens from superposition vault
async function mint(mintUAccount, startDate, endDate, amount) {
  console.log("Minting " + amount + " superposition tokens");


  const mintUKey = new anchor.web3.PublicKey(mintUAccount);

  const tokenUAccounts = await getTokenAccountsByMint(provider, mintUKey);
  if (!tokenUAccounts || tokenUAccounts.length == 0) {
    console.error("Error: could not find an underlying token account for mint " +
        mintUKey);
    return;
  }
  const tokenUKey = tokenUAccounts[0];

  const startTime = new Date(startDate);
  const startUnixTime = new anchor.BN(Math.floor(startTime.getTime() / 1000));
  const endTime = new Date(endDate);
  const endUnixTime = new anchor.BN(Math.floor(endTime.getTime() / 1000));

  // Generate the program client from IDL.
  const program = getProgram();

  const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("vault"),
      mintUKey.toBuffer(),
      anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
      anchor.utils.bytes.utf8.encode(endUnixTime.toString())
    ],
    program.programId
  );
  const vault = await program.account.saberVault.fetch(
    vaultAccount
  );

  let instructions = [];
  let signers = [];

  let tokenPKey = null;
  const tokenPAccounts = await getTokenAccountsByMint(provider, vault.mintP);
  if (!tokenPAccounts || tokenPAccounts.length == 0) {
    const tokenPAccount = anchor.web3.Keypair.generate();
    tokenPKey = tokenPAccount.publicKey;
    instructions.push(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: tokenPKey,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
            token.AccountLayout.span),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );
    instructions.push(
      token.Token.createInitAccountInstruction(
        token.TOKEN_PROGRAM_ID,
        vault.mintP,
        tokenPKey,
        provider.wallet.publicKey,
      )
    );
    signers.push(tokenPAccount);
  } else {
    tokenPKey = tokenPAccounts[0];
  }

  let tokenYKey = null;
  const tokenYAccounts = await getTokenAccountsByMint(provider, vault.mintY);
  if (!tokenYAccounts || tokenYAccounts.length == 0) {
    const tokenYAccount = anchor.web3.Keypair.generate();
    tokenYKey = tokenYAccount.publicKey;
    instructions.push(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: tokenYKey,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
            token.AccountLayout.span),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );
    instructions.push(
      token.Token.createInitAccountInstruction(
        token.TOKEN_PROGRAM_ID,
        vault.mintY,
        tokenYKey,
        provider.wallet.publicKey,
      )
    );
    signers.push(tokenYAccount);
  } else {
    tokenYKey = tokenYAccounts[0];
  }

  const bnAmount = new anchor.BN(amount);

  mintToAccounts = {
    accounts: {
      authority: provider.wallet.publicKey,
      vault: vaultAccount,
      tokenU: vault.tokenU,
      mintU: mintUKey,
      mintP: vault.mintP,
      mintY: vault.mintY,
      tokenUFrom: tokenUKey,
      tokenP: tokenPKey,
      tokenY: tokenYKey,
      tokenProgram: token.TOKEN_PROGRAM_ID
    },
  };
  if (instructions.length > 0) {
    mintToAccounts.intructions = instructions;
  }
  if (signers.length > 0) {
    mintToAccounts.signers = signers;
  }
  await program.rpc.mintTo(bump, startUnixTime, endUnixTime, bnAmount, mintToAccounts);

  console.log("Deposited " + amount + " tokens from " +
      tokenUKey.toString() + " to " + vault.tokenU.toString());
  console.log("Minted " + amount + " principal tokens to " +
      tokenPKey.toString());
  console.log("Minted " + amount + " yield tokens to " +
      tokenYKey.toString());
}

// Redeems superposition tokens into vault
async function redeem(mintUAccount, startDate, endDate, amount) {
  console.log('Redeeming ' + amount + ' superposition tokens');

  const mintUKey = new anchor.web3.PublicKey(mintUAccount);

  const tokenUAccounts = await getTokenAccountsByMint(provider, mintUKey);
  if (!tokenUAccounts || tokenUAccounts.length == 0) {
    //TODO: create an underlying asset account if the user doesn't have one already
    //the user may acquire PTs and YTs before ever acquiring the underlying asset
    console.error("Error: could not find an underlying token account for mint " +
        mintUKey);
    return;
  }
  const tokenUKey = tokenUAccounts[0];

  const startTime = new Date(startDate);
  const startUnixTime = new anchor.BN(Math.floor(startTime.getTime() / 1000));
  const endTime = new Date(endDate);
  const endUnixTime = new anchor.BN(Math.floor(endTime.getTime() / 1000));

  // Generate the program client from IDL.
  const program = getProgram();

  const [vaultAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("vault"),
      mintUKey.toBuffer(),
      anchor.utils.bytes.utf8.encode(startUnixTime.toString()),
      anchor.utils.bytes.utf8.encode(endUnixTime.toString())
    ],
    program.programId
  );
  const vault = await program.account.saberVault.fetch(
    vaultAccount
  );

  let instructions = [];
  let signers = [];

  let tokenPKey = null;
  const tokenPAccounts = await getTokenAccountsByMint(provider, vault.mintP);
  if (!tokenPAccounts || tokenPAccounts.length == 0) {
    console.error("Error: could not find an principal token account for mint " +
        vault.mintP);
    return;
  }
  tokenPKey = tokenPAccounts[0];

  let tokenYKey = null;
  const tokenYAccounts = await getTokenAccountsByMint(provider, vault.mintY);
  if (!tokenYAccounts || tokenYAccounts.length == 0) {
    console.error("Error: could not find an principal token account for mint " +
        vault.mintY);
    return;
  }
  tokenYKey = tokenYAccounts[0];

  const bnAmount = new anchor.BN(amount);

  await program.rpc.redeem(bump, startUnixTime, endUnixTime, bnAmount, {
    accounts: {
      authority: provider.wallet.publicKey,
      vault: vaultAccount,
      tokenU: vault.tokenU,
      mintU: vault.mintU,
      mintP: vault.mintP,
      mintY: vault.mintY,
      tokenUTo: tokenUKey,
      tokenP: tokenPKey,
      tokenY: tokenYKey,
      tokenProgram: token.TOKEN_PROGRAM_ID
    },
  });

  console.log("Withdrew " + amount + " tokens to " +
      tokenUKey.toString() + " from " + vault.tokenU.toString());
  console.log("Burned " + amount + " principal tokens from " +
      tokenPKey.toString());
  console.log("Burned " + amount + " yield tokens from " +
      tokenYKey.toString());
}

async function getTokenAccountsByMint(provider, mint) {
  const res = await provider.connection.getParsedTokenAccountsByOwner(
    provider.wallet.publicKey,
    { mint }
  );
  const data = res.value.map(
    (v) => v.pubkey
  );
  return data;
}

async function createLiquidityPool(mintA, mintB) {
  console.log("Creating liquidity pool for mint " + mintA +
      " and mint " + mintB);
  const mintAKey = new anchor.web3.PublicKey(mintA);
  const mintBKey = new anchor.web3.PublicKey(mintB);

  // The account where the Liquidity Pool shall be initialized
  const liquidityPoolAccount = anchor.web3.Keypair.generate();
  const [authority, bumpSeed] = await anchor.web3.PublicKey.findProgramAddress(
    [liquidityPoolAccount.publicKey.toBuffer()],
    tokenSwap.TOKEN_SWAP_PROGRAM_ID,
  );

  // A constant product swap pool does not allow zero balance
  // of either token in the pool. So fund the pool's mintA token account
  // with the current wallet.
  const walletTokenAAccounts = await getTokenAccountsByMint(provider, mintAKey);
  if (!walletTokenAAccounts || walletTokenAAccounts.length == 0) {
    console.error("Error: could not find an underlying token account for mint " +
        mintAKey);
    return;
  }
  const walletTokenA = walletTokenAAccounts[0];

  //TODO: dynamically discover the token decimals
  // The amount of tokens to fund the pool's mintA token account
  const amountA = 1000000; // assuming 6 decimal tokens
  // The pool's mintA token account
  const poolTokenA = await createTokenAccount(
      provider, mintAKey, authority, walletTokenA, amountA);

  // A constant product swap pool does not allow zero balance
  // of either token in the pool. So fund the pool's mintB token account
  // with the current wallet.
  const walletTokenBAccounts = await getTokenAccountsByMint(provider, mintBKey);
  if (!walletTokenBAccounts || walletTokenBAccounts.length == 0) {
    console.error("Error: could not find an underlying token account for mint " +
        mintBKey);
    return;
  }
  const walletTokenB = walletTokenBAccounts[0];

  //TODO: dynamically discover the token decimals
  // The amount of tokens to fund the pool's mintB token account
  const amountB = 1000000; // assuming 6 decimal tokens
  // The pool's mintB token account
  const poolTokenB = await createTokenAccount(
      provider, mintBKey, authority, walletTokenB, amountB);

  // The LP token's mint
  const mintLP = await token.Token.createMint(
    provider.connection,
    provider.wallet.payer,
    authority,
    null,
    2,
    token.TOKEN_PROGRAM_ID,
  );

  //The default SPL token swap program requires the fee acount to be
  //owned by this pre-determined account. We may create zero-fee pools
  //but if we want to own the fees on a pool then we must deploy
  //the SPL token swap to our own program account.
  const feeOwner = new anchor.web3.PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN");
  const feeAccount = await mintLP.createAccount(feeOwner);

  // The user's wallet will receive LP tokens in this account in return
  // for their initial funding of the Token A and Token B pools
  const creatorTokenLP = await mintLP.createAccount(provider.wallet.publicKey);

  const TRADING_FEE_NUMERATOR = 25;
  const TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_TRADING_FEE_NUMERATOR = 5;
  const OWNER_TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_WITHDRAW_FEE_NUMERATOR = 0;
  const OWNER_WITHDRAW_FEE_DENOMINATOR = 0;
  const HOST_FEE_NUMERATOR = 20;
  const HOST_FEE_DENOMINATOR = 100;
  const pool = await tokenSwap.TokenSwap.createTokenSwap(
    provider.connection,
    provider.wallet.payer,
    liquidityPoolAccount,
    authority,
    poolTokenA,
    poolTokenB,
    mintLP.publicKey,
    mintAKey,
    mintBKey,
    feeAccount,
    creatorTokenLP,
    tokenSwap.TOKEN_SWAP_PROGRAM_ID,
    token.TOKEN_PROGRAM_ID,
    bumpSeed,
    TRADING_FEE_NUMERATOR,
    TRADING_FEE_DENOMINATOR,
    OWNER_TRADING_FEE_NUMERATOR,
    OWNER_TRADING_FEE_DENOMINATOR,
    OWNER_WITHDRAW_FEE_NUMERATOR,
    OWNER_WITHDRAW_FEE_DENOMINATOR,
    HOST_FEE_NUMERATOR,
    HOST_FEE_DENOMINATOR,
    tokenSwap.CurveType.ConstantProduct,
  );

  console.log("Created liquidity pool: " + liquidityPoolAccount.publicKey.toString());
  console.log("Token A account: " + poolTokenA.toString());
  console.log("Token B account: " + poolTokenB.toString());
  console.log("LP token mint: " + mintLP.publicKey.toString());
  console.log("Creator's LP token account: " + creatorTokenLP.toString());
  console.log("Fee account: " + feeAccount.toString());
}

async function swap(liquidityPool, fromMint, amount) {
  console.log('Swapping ' + amount + ' of mint ' +
      fromMint + ' on LP ' + liquidityPool);
  const fromMintKey = new anchor.web3.PublicKey(fromMint);

  const transaction = new anchor.web3.Transaction();
  let signers = [];

  let fromTokenKey = null;
  const fromTokenAccounts = await getTokenAccountsByMint(provider, fromMintKey);
  if (!fromTokenAccounts || fromTokenAccounts.length == 0) {
    console.error('Error: could not find token account for mint ' + fromMint);
    return;
  }
  fromTokenKey = fromTokenAccounts[0];

  const lpKey = new anchor.web3.PublicKey(liquidityPool);

  const lpInfo = await tokenSwap.TokenSwap.loadTokenSwap(
    provider.connection,
    lpKey,
    tokenSwap.TOKEN_SWAP_PROGRAM_ID,
    provider.wallet.payer,
  );

  let toMintKey = null;
  let fromPoolAccount = null;
  let toPoolAccount = null;
  if (lpInfo.mintA.toString() == fromMintKey.toString()) {
    toMintKey = lpInfo.mintB;
    fromPoolAccount = lpInfo.tokenAccountA;
    toPoolAccount = lpInfo.tokenAccountB;
  } else if (lpInfo.mintB.toString() == fromMintKey.toString()) {
    toMintKey = lpInfo.mintA;
    fromPoolAccount = lpInfo.tokenAccountB;
    toPoolAccount = lpInfo.tokenAccountA;
  } else {
    console.error('Error: the provided mint and liquidity pool don\'t match');
    return
  }

  let toTokenKey = null;
  const toTokenAccounts = await getTokenAccountsByMint(provider, toMintKey);
  if (!toTokenAccounts || toTokenAccounts.length == 0) {
    const toTokenAccount = anchor.web3.Keypair.generate();
    toTokenKey = toTokenAccount.publicKey;
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: toTokenKey,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
            token.AccountLayout.span),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );
    transaction.add(
      token.Token.createInitAccountInstruction(
        token.TOKEN_PROGRAM_ID,
        toMintKey,
        toTokenKey,
        provider.wallet.publicKey,
      )
    );
    signers.push(toTokenAccount);
  } else {
    toTokenKey = toTokenAccounts[0];
  }

  const userTransferAuthority = anchor.web3.Keypair.generate();
  transaction.add(
    token.Token.createApproveInstruction(
      token.TOKEN_PROGRAM_ID,
      fromTokenKey,
      userTransferAuthority.publicKey,
      provider.wallet.publicKey,
      [provider.wallet],
      amount,
    ),
  );
  signers.push(userTransferAuthority);

  transaction.add(
    tokenSwap.TokenSwap.swapInstruction(
      lpInfo.tokenSwap,
      lpInfo.authority,
      userTransferAuthority.publicKey,
      fromTokenKey,
      fromPoolAccount,
      toPoolAccount,
      toTokenKey,
      lpInfo.poolToken,
      lpInfo.feeAccount,
      null,
      lpInfo.swapProgramId,
      lpInfo.tokenProgramId,
      amount,
      0,
    ),
  );

  provider.send(transaction, signers);
}

async function deposit(liquidityPool, amount) {
  console.log("Depositing " + amount + " to " + liquidityPool);

  const lpKey = new anchor.web3.PublicKey(liquidityPool);

  const lpSwap = await tokenSwap.TokenSwap.loadTokenSwap(
    provider.connection,
    lpKey,
    tokenSwap.TOKEN_SWAP_PROGRAM_ID,
    provider.wallet.payer,
  );

  const lpToken = new token.Token(
    provider.connection,
    lpSwap.poolToken,
    token.TOKEN_PROGRAM_ID,
    provider.wallet.payer
  );

  const transaction = new anchor.web3.Transaction();
  let signers = [];

  let lpAccountKey = null;
  const lpAccounts = await getTokenAccountsByMint(provider, lpSwap.poolToken);
  if (!lpAccounts || lpAccounts.length == 0) {
    const lpAccount = anchor.web3.Keypair.generate();
    lpAccountKey = lpAccount.publicKey;
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: lpAccountKey,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
            token.AccountLayout.span),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      })
    );
    transaction.add(
      token.Token.createInitAccountInstruction(
        token.TOKEN_PROGRAM_ID,
        lpSwap.poolToken,
        lpAccountKey,
        provider.wallet.publicKey,
      )
    );
    signers.push(lpAccount);
  } else {
    lpAccountKey = lpAccounts[0];
  }

  const tokenAAccounts = await getTokenAccountsByMint(provider, lpSwap.mintA);
  if (!tokenAAccounts || tokenAAccounts.length == 0) {
    console.error("Error: could not find an token account for mint " +
        lpSwap.mintA.toString());
    return;
  }
  const tokenAAccount = tokenAAccounts[0];

  const mintAToken = new token.Token(
    provider.connection,
    lpSwap.mintA,
    token.TOKEN_PROGRAM_ID,
    provider.wallet.payer
  );
  const tokenAPoolInfo = await mintAToken.getAccountInfo(lpSwap.tokenAccountA);
  const lpMintInfo = await lpToken.getMintInfo();
  const lpSupply = lpMintInfo.supply.toNumber();
  const lpMinimumAmountA = tradingTokensToPoolTokens(
    amount,
    tokenAPoolInfo.amount.toNumber(),
    lpSupply,
    lpSwap.tradeFeeNumerator.toNumber(),
    lpSwap.tradeFeeDenominator.toNumber(),
  );

  const userTransferAuthorityA = anchor.web3.Keypair.generate();
  transaction.add(
    token.Token.createApproveInstruction(
      token.TOKEN_PROGRAM_ID,
      tokenAAccount,
      userTransferAuthorityA.publicKey,
      provider.wallet.publicKey,
      [],
      amount,
    ),
  );
  signers.push(userTransferAuthorityA);

  transaction.add(
    tokenSwap.TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
      lpSwap.tokenSwap,
      lpSwap.authority,
      userTransferAuthorityA.publicKey,
      tokenAAccount,
      lpSwap.tokenAccountA,
      lpSwap.tokenAccountB,
      lpSwap.poolToken,
      lpAccountKey,
      lpSwap.swapProgramId,
      lpSwap.tokenProgramId,
      amount,
      lpMinimumAmountA,
    )
  );

  const tokenBAccounts = await getTokenAccountsByMint(provider, lpSwap.mintB);
  if (!tokenBAccounts || tokenBAccounts.length == 0) {
    console.error("Error: could not find an token account for mint " +
        lpSwap.mintB.toString());
    return;
  }
  const tokenBAccount = tokenBAccounts[0];

  const mintBToken = new token.Token(
    provider.connection,
    lpSwap.mintB,
    token.TOKEN_PROGRAM_ID,
    provider.wallet.payer
  );
  const tokenBPoolInfo = await mintBToken.getAccountInfo(lpSwap.tokenAccountB);
  const lpMinimumAmountB = tradingTokensToPoolTokens(
    amount,
    tokenBPoolInfo.amount.toNumber(),
    lpSupply,
    lpSwap.tradeFeeNumerator.toNumber(),
    lpSwap.tradeFeeDenominator.toNumber(),
  );

  const userTransferAuthorityB = anchor.web3.Keypair.generate();
  transaction.add(
    token.Token.createApproveInstruction(
      token.TOKEN_PROGRAM_ID,
      tokenBAccount,
      userTransferAuthorityB.publicKey,
      provider.wallet.publicKey,
      [],
      amount,
    ),
  );
  signers.push(userTransferAuthorityB);

  transaction.add(
    tokenSwap.TokenSwap.depositSingleTokenTypeExactAmountInInstruction(
      lpSwap.tokenSwap,
      lpSwap.authority,
      userTransferAuthorityB.publicKey,
      tokenBAccount,
      lpSwap.tokenAccountA,
      lpSwap.tokenAccountB,
      lpSwap.poolToken,
      lpAccountKey,
      lpSwap.swapProgramId,
      lpSwap.tokenProgramId,
      amount,
      lpMinimumAmountB,
    )
  );

  provider.send(transaction, signers);
}

function tradingTokensToPoolTokens(
  sourceAmount,
  swapSourceAmount,
  poolAmount,
  tradeFeeNumerator,
  tradeFeeDenominator,
) {
  const tradingFee =
    (sourceAmount / 2) * (tradeFeeNumerator / tradeFeeDenominator);
  const sourceAmountPostFee = sourceAmount - tradingFee;
  const root = Math.sqrt(sourceAmountPostFee / swapSourceAmount + 1);
  return Math.floor(poolAmount * (root - 1));
}

async function createTokenAccount(provider, mint, authority, source, amount) {
  const t = new token.Token(
    provider.connection,
    mint,
    token.TOKEN_PROGRAM_ID,
    provider.wallet.payer
  );
  const newAccount = await t.createAccount(authority);
  t.transferChecked(source, newAccount, provider.wallet, [], amount, 6);
  return newAccount;
}
