# BlockLeaseDAC

The BlockLease Decentralized Autonomous Collective is a smart contract that defines an ERC20 token with the symbol `LEASE`.

## Profit Mechanism

Holding lease tokens automatically entitles you to a proportionate amount of the funds sent to the `pay` function. Address balances are recalculated with every token transfer to ensure that payouts are transferred with tokens.

## Bonuses

All funds sent to the `pay` function of the BlockLeaseDAC contract will return `10%` of the funds paid in `LEASE` at the exchange rate specified by `tokensPerEth`.

## Proposals

The DAC includes a `Proposal` struct like the following:

```
  struct Proposal {
    uint256 tokensForSale;
    uint256 tokensPerEth;
    uint256 bonusPool;
    uint256 proposalVotingTime;
    uint256 timestamp;
    uint256 totalVotes;
  }
```

Proposals to increase the `tokensForSale`, `tokensPerEth`, `bonusPool`, and `proposalVotingTime` can be voted on by token holders.

Votes last `proposalVotingTime` seconds. At the end the changes will be applied if at least `tokensSold / 2` tokens are used to vote in favor of the change.

## Proposal Usage

Proposals can be used for subsequent funding rounds.
