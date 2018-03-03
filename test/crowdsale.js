'use strict';

const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');
const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');
const {
  throwToBool,
  createProposal,
  applyProposal,
  votingEndBlock,
  waitForBlock,
  activeProposal
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

});
