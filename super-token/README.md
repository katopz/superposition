# Super token

Token program for the superposition project. This is based on anchor's
token-proxy program which simply wraps the basic methods of an SPL
token.

# Build and test

1. Install [anchor cli](https://project-serum.github.io/anchor/getting-started/installation.html).
2. Install dependencies `yarn`
2. Build program with `anchor build`
3. Run test client with `anchor test`

You should see output like this

```
Your transaction signature 8hroeWMswHYRAxgp28AbcKTotcJF35zAvevGznsGTXZnrjfjfxBwDyFfj2R5r3zHSxoGBVTXqVTMbVZ6eBQGvDT
    ✔ Is initialized! (258ms)
      ✔ Initializes test state (1268ms)
      ✔ Mints a token (415ms)
      ✔ Transfers a token (419ms)
      ✔ Burns a token (417ms)
      ✔ Set new mint authority (428ms)


    6 passing (3s)
```
