'use strict';

const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');
const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');
const {
  TOKENS_FOR_SALE_INDEX,
  TOKENS_PER_ETH_INDEX,
  BONUS_POOL_INDEX,
  OPERATOR_POOL_INDEX,
  VOTING_BLOCK_COUNT_INDEX,
  BLOCK_NUMBER_INDEX,
  throwToBool,
  createProposal,
  applyProposal,
  votingEndBlock,
  waitForBlock,
  activeProposal
} = require('../utils');

contract('BlockLeaseDAC', (accounts) => {

  it('should fail to create proposal from non operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(!await createProposal(dac, accounts[1], [
      200000000, // tokensForSale
      200000, // tokensPerEth
      200000000, // bonusPool
      200000000, // operatorPool
      60000 // votingBlockCount
    ]));
  });

  it('should create first proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(await createProposal(dac, accounts[0], [
      200000000, // tokensForSale
      200000, // tokensPerEth
      200000000, // bonusPool
      200000000, // operatorPool
      5 // votingBlockCount
    ]));

    const balance = await dac.balanceOf.call(dac.address);
    const totalSupply = await dac.totalSupply.call();
    assert.equal(balance.toString(), totalSupply.toString(), 'Contract balance is incorrect');
  });

  it('should fail to apply initial proposal before voting end block', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(!await applyProposal(dac, accounts[0]), 'Applied proposal prematurely');
  });

  it('should fail to apply initial proposal from non operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const block = await votingEndBlock(dac);

    console.log(`Waiting until block ${block} to apply initial proposal`);
    await waitForBlock(block);
    assert(!await applyProposal(dac, accounts[1]), 'Non-operator applied proposal');
  });

  it('should apply initial proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);

    const block = await votingEndBlock(dac);
    await waitForBlock(block);
    assert(await applyProposal(dac, accounts[0]), 'Failed to apply proposal');

    const tokensForSale = await dac.tokensForSale.call();
    const tokensPerEth = await dac.tokensPerEth.call();
    const bonusPool = await dac.bonusPool.call();
    const operatorPool = await dac.operatorPool.call();
    assert.equal(tokensForSale.toString(), proposal[TOKENS_FOR_SALE_INDEX].toString(), 'Tokens for sale is incorrect');
    assert.equal(tokensPerEth.toString(), proposal[TOKENS_PER_ETH_INDEX].toString(), 'Tokens per eth is incorrect');
    assert.equal(bonusPool.toString(), proposal[BONUS_POOL_INDEX].toString(), 'Bonus pool is incorrect');
    assert.equal(operatorPool.toString(), proposal[OPERATOR_POOL_INDEX].toString(), 'Dev pool is incorrect');
  });

  it('should fail to create a new proposal if not operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    assert(!await createProposal(dac, accounts[1], proposal), 'Non-operator created proposal');
  });

  it('should fail to create proposal with lower tokensForSale value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[TOKENS_FOR_SALE_INDEX] = proposal[TOKENS_FOR_SALE_INDEX] - 1;
    assert(!await createProposal(dac, accounts[0], proposal), 'Decreased tokensForSale in proposal');
  });

  it('should fail to create proposal with higher tokensPerEth value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[TOKENS_PER_ETH_INDEX] = +proposal[TOKENS_PER_ETH_INDEX] + 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Increased tokensPerEth in proposal'));
  });

  it('should fail to create proposal with lower bonusPool value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[BONUS_POOL_INDEX] = +proposal[BONUS_POOL_INDEX] - 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Decreased bonusPool in proposal'));
  });

  it('should fail to create proposal with lower operatorPool value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[OPERATOR_POOL_INDEX] = +proposal[OPERATOR_POOL_INDEX] - 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Decreased operatorPool in proposal'));
  });

  it('should fail to create proposal with votingBlockCount <= 1', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[VOTING_BLOCK_COUNT_INDEX] = 0;
    assert(!await createProposal(dac, accounts[0], proposal, 'Set votingBlockCount to 0 in proposal'));
    proposal[VOTING_BLOCK_COUNT_INDEX] = 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Set votingBlockCount to 1 in proposal'));
  });

  it('should create another proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(await createProposal(dac, accounts[0], [
      200000000,
      200000,
      200000000,
      200000000,
      5
    ]), 'Failed to create proposal');
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

  it('should fail to send less than the minimum amount', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const minimumPurchaseWei = await dac.minimumPurchaseWei.call();
    assert(!await throwToBool(async () => {
      await dac.sendTransaction({
        from: accounts[1],
        to: dac.address,
        value: minimumPurchaseWei - 1
      })
    }), 'Sent less than the minimum purchase wei');
  });

});
