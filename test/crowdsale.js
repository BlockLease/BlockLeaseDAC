'use strict';

const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');
const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');
const {
  throwToBool,
  createProposal,
  applyProposal,
  votingEndBlock,
  waitForBlock,
  activeProposal,
  TOKENS_PER_ETH_INDEX
} = require('../utils');

contract('BlockLeaseDAC', (accounts) => {

  it('should create initial proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(await createProposal(dac, accounts[0], [
      200000000, // tokensForSale
      200000, // tokensPerEth
      200000000, // bonusPool
      200000000, // operatorPool
      6 // votingBlockCount
    ]), 'Failed to create initial proposal');
  });

  it('should apply initial proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const voteEndBlock = await votingEndBlock(dac);
    console.log(`Waiting until block ${voteEndBlock} to apply initial proposal`);
    await waitForBlock(voteEndBlock);
    assert(await applyProposal(dac, accounts[0]), 'Failed to apply initial proposal');
  });

  it('should sell tokens', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const ethToSend = 1;
    assert(await throwToBool(async () => {
      await dac.sendTransaction({
        from: accounts[1],
        to: dac.address,
        value: web3.toWei(ethToSend, 'ether')
      });
    }), 'Failed to sell tokens');
    const proposal = await activeProposal(dac);
    const expectedBalance = proposal[TOKENS_PER_ETH_INDEX] * ethToSend;
    const actualBalance = await dac.balanceOf.call(accounts[1]);
    assert(+actualBalance === +expectedBalance, `Expected token balance to be ${expectedBalance}, received ${actualBalance}`);
  });

});
