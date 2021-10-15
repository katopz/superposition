use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo as SplMintTo, Token, TokenAccount, Transfer};
use std::mem::size_of;

declare_id!("DiyQRLEe3AgVV6TV3bGTYWZaS5TN9baFt9tXFSr3zS7e");

/// A program for managing and interacting with superposition vaults
#[program]
pub mod super_token {
    use super::*;

    /// Mints superposition tokens from a deposited underlying asset.
    pub fn mint_to(
        ctx: Context<MintTo>,
        bump: u8,
        start_time: i64,
        end_time: i64,
        amount: u64,
    ) -> ProgramResult {
        let balance =
            token::accessor::amount(&ctx.accounts.token_u_from.to_account_info()).unwrap();
        if amount > balance {
            return Err(ErrorCode::InsufficientUnderlyingFunds.into());
        }

        let accounts_u = Transfer {
            from: ctx.accounts.token_u_from.to_account_info(),
            to: ctx.accounts.token_u.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let program_u = ctx.accounts.token_program.to_account_info();
        let ctx_u = CpiContext::new(program_u, accounts_u);
        if token::transfer(ctx_u, amount).is_err() {
            return Err(ErrorCode::DepositUnderlyingToken.into());
        }

        let start_time_str = start_time.to_string();
        let end_time_str = end_time.to_string();
        let seeds = &[
            &b"vault"[..],
            ctx.accounts.token_u.mint.as_ref(),
            start_time_str.as_bytes(),
            end_time_str.as_bytes(),
            &[bump],
        ];

        let accounts_p = SplMintTo {
            mint: ctx.accounts.mint_p.to_account_info(),
            to: ctx.accounts.token_p.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let program_p = ctx.accounts.token_program.to_account_info();
        let ctx_p = CpiContext::new(program_p, accounts_p);
        if token::mint_to(ctx_p.with_signer(&[&seeds[..]]), amount).is_err() {
            return Err(ErrorCode::MintPrincipalToken.into());
        }

        let accounts_y = SplMintTo {
            mint: ctx.accounts.mint_y.to_account_info(),
            to: ctx.accounts.token_y.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let program_y = ctx.accounts.token_program.to_account_info();
        let ctx_y = CpiContext::new(program_y, accounts_y);
        if token::mint_to(ctx_y.with_signer(&[&seeds[..]]), amount).is_err() {
            return Err(ErrorCode::MintYieldToken.into());
        }

        Ok(())
    }

    /// Redeems underlying asset from superposition tokens.
    pub fn redeem(
        ctx: Context<Redeem>,
        bump: u8,
        start_time: i64,
        end_time: i64,
        amount: u64,
    ) -> ProgramResult {
        let accounts_p = Burn {
            mint: ctx.accounts.mint_p.to_account_info(),
            to: ctx.accounts.token_p.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let program_p = ctx.accounts.token_program.to_account_info();
        let ctx_p = CpiContext::new(program_p, accounts_p);
        if token::burn(ctx_p, amount).is_err() {
            return Err(ErrorCode::BurnPrincipalToken.into());
        }

        let accounts_y = Burn {
            mint: ctx.accounts.mint_y.to_account_info(),
            to: ctx.accounts.token_y.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let program_y = ctx.accounts.token_program.to_account_info();
        let ctx_y = CpiContext::new(program_y, accounts_y);
        if token::burn(ctx_y, amount).is_err() {
            return Err(ErrorCode::BurnYieldToken.into());
        }

        let start_time_str = start_time.to_string();
        let end_time_str = end_time.to_string();
        let seeds = &[
            &b"vault"[..],
            ctx.accounts.token_u.mint.as_ref(),
            start_time_str.as_bytes(),
            end_time_str.as_bytes(),
            &[bump],
        ];

        let accounts_u = Transfer {
            from: ctx.accounts.token_u.to_account_info(),
            to: ctx.accounts.token_u_to.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let program_u = ctx.accounts.token_program.to_account_info();
        let ctx_u = CpiContext::new(program_u, accounts_u);
        if token::transfer(ctx_u.with_signer(&[&seeds[..]]), amount).is_err() {
            return Err(ErrorCode::WithdrawUnderlyingToken.into());
        }

        Ok(())
    }

    /// Creates a superposition vault that holds an underlying asset
    /// and mints superposition tokens.
    ///
    /// TODO
    /// - Add snapshot of Saber liquidity
    pub fn create_vault(
        ctx: Context<CreateSaberVault>,
        _bump: u8,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let mint_u = ctx.accounts.mint_u.key();
        let token_u = ctx.accounts.token_u.key();
        let mint_y = ctx.accounts.mint_y.key();
        let mint_p = ctx.accounts.mint_p.key();
        vault.start_time = start_time;
        vault.end_time = end_time;
        vault.mint_u = mint_u;
        vault.token_u = token_u;
        vault.mint_p = mint_p;
        vault.mint_y = mint_y;

        Ok(())
    }
}

/// Error codes thrown by the super token instructions.
#[error]
pub enum ErrorCode {
    #[msg("Insufficient funds from underlying token account")]
    InsufficientUnderlyingFunds,
    #[msg("Failed to deposit underlying token")]
    DepositUnderlyingToken,
    #[msg("Failed to mint principal token")]
    MintPrincipalToken,
    #[msg("Failed to mint yield token")]
    MintYieldToken,
    #[msg("Failed to burn principal token")]
    BurnPrincipalToken,
    #[msg("Failed to burn yield token")]
    BurnYieldToken,
    #[msg("Failed to withdraw underlying token")]
    WithdrawUnderlyingToken,
    #[msg("Failed to set authority on underlying token account")]
    SetAuthorityTokenU,
}

/// Accounts for create_vault instruction
#[derive(Accounts)]
#[instruction(bump: u8, start_time: i64, end_time: i64)]
pub struct CreateSaberVault<'info> {
    /// underlying token mint
    pub mint_u: Account<'info, Mint>,

    /// underlying token deposit acccount
    #[account(init, token::mint = mint_u, token::authority = vault, payer = payer)]
    pub token_u: Account<'info, TokenAccount>,

    /// yield token mint
    #[account(init, mint::decimals = 6, mint::authority = vault, payer = payer)]
    pub mint_y: ProgramAccount<'info, Mint>,

    /// principal token mint
    #[account(init, mint::decimals = 6, mint::authority = vault, payer = payer)]
    pub mint_p: ProgramAccount<'info, Mint>,

    /// vault metadata account
    #[account(
        init,
        seeds = [
            b"vault".as_ref(),
            mint_u.key().as_ref(),
            start_time.to_string().as_ref(),
            end_time.to_string().as_ref()
        ],
        bump = bump,
        payer = payer,
        space = 8 + size_of::<SaberVault>()
    )]
    pub vault: ProgramAccount<'info, SaberVault>,

    /// caller who pays for the accounts
    pub payer: Signer<'info>,

    /// current cluster rent
    pub rent: Sysvar<'info, Rent>,

    /// solana system program
    pub system_program: Program<'info, System>,

    /// spl token program
    pub token_program: Program<'info, Token>,
}

/// Account that describes a superposition vault
///
/// TODO
/// - snapshot of saber liquidity for mint
#[account]
pub struct SaberVault {
    /// start of the vault's term as a Unix time stamp.
    pub start_time: i64,

    /// end of the vault's term as a Unix time stamp.
    pub end_time: i64,

    /// yield token mint
    pub mint_y: Pubkey,

    /// principal token mint
    pub mint_p: Pubkey,

    /// underlying token mint
    pub mint_u: Pubkey,

    /// underlying token desposit account
    pub token_u: Pubkey,
}

/// Accounts for mint_to instruction
#[derive(Accounts)]
#[instruction(bump: u8, start_time: i64, end_time: i64)]
pub struct MintTo<'info> {
    /// token authority of the token_u_from, token_p and token_y
    /// accounts required for minting and transfers
    pub authority: Signer<'info>,

    /// vault metadata account
    #[account(
        has_one = token_u,
        has_one = mint_u,
        has_one = mint_y,
        has_one = mint_p,
        seeds = [
            b"vault".as_ref(),
            mint_u.key().as_ref(),
            start_time.to_string().as_ref(),
            end_time.to_string().as_ref()
        ],
        bump = bump
    )]
    pub vault: ProgramAccount<'info, SaberVault>,

    /// principal token mint
    #[account(mut)]
    pub mint_u: Box<Account<'info, Mint>>,

    /// principal token mint
    #[account(mut)]
    pub mint_p: Box<Account<'info, Mint>>,

    /// yield token mint
    #[account(mut)]
    pub mint_y: Box<Account<'info, Mint>>,

    /// account where minted principal tokens will be deposited
    #[account(
        mut,
        constraint = token_p.mint == mint_p.key(),
        constraint = token_p.owner == authority.key(),
    )]
    pub token_p: Account<'info, TokenAccount>,

    /// account where minted yield tokens will be deposited
    #[account(
        mut,
        constraint = token_y.mint == mint_y.key(),
        constraint = token_y.owner == authority.key(),
    )]
    pub token_y: Account<'info, TokenAccount>,

    /// vault's underlying token deposit account
    #[account(mut)]
    pub token_u: Box<Account<'info, TokenAccount>>,

    /// source of funds for underlying token deposit
    #[account(
        mut,
        constraint = token_u_from.mint == vault.mint_u,
        constraint = token_u_from.owner == authority.key(),
    )]
    pub token_u_from: Box<Account<'info, TokenAccount>>,

    /// spl token program
    pub token_program: Program<'info, Token>,
}

/// Accounts for redeem instruction
#[derive(Accounts)]
#[instruction(bump: u8, start_time: i64, end_time: i64)]
pub struct Redeem<'info> {
    /// token authority of the token_p and token_y accounts
    /// required to burn the tokens in exchange for the underlying
    /// asset.
    pub authority: Signer<'info>,

    /// vault metadata account
    #[account(
        has_one = token_u,
        has_one = mint_u,
        has_one = mint_y,
        has_one = mint_p,
        seeds = [
            b"vault".as_ref(),
            mint_u.key().as_ref(),
            start_time.to_string().as_ref(),
            end_time.to_string().as_ref()
        ],
        bump = bump
    )]
    pub vault: ProgramAccount<'info, SaberVault>,

    /// principal token mint
    #[account(mut)]
    pub mint_u: Box<Account<'info, Mint>>,

    /// principal token mint
    #[account(mut)]
    pub mint_p: Box<Account<'info, Mint>>,

    /// yield token mint
    #[account(mut)]
    pub mint_y: Box<Account<'info, Mint>>,

    /// account where minted principal tokens will be deposited
    #[account(
        mut,
        constraint = token_p.mint == vault.mint_p,
        constraint = token_p.owner == authority.key(),
    )]
    pub token_p: Box<Account<'info, TokenAccount>>,

    /// account where minted yield tokens will be deposited
    #[account(
        mut,
        constraint = token_y.mint == vault.mint_y,
        constraint = token_y.owner == authority.key(),
    )]
    pub token_y: Box<Account<'info, TokenAccount>>,

    /// vault's underlying token deposit account
    #[account(mut, constraint = token_u.mint == vault.mint_u)]
    pub token_u: Box<Account<'info, TokenAccount>>,

    /// destination for underlying token withdrawal
    #[account(
        mut,
        constraint = token_u_to.mint == vault.mint_u,
        constraint = token_u_to.owner == authority.key(),
    )]
    pub token_u_to: Box<Account<'info, TokenAccount>>,

    /// spl token program
    pub token_program: Program<'info, Token>,
}
