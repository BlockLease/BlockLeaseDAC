'use strict';

const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');
const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');

const TOKENS_FOR_SALE_INDEX = 0;
const TOKENS_PER_ETH_INDEX = 1;
const BONUS_POOL_INDEX = 2;
const DEV_POOL_INDEX = 3;
const VOTING_BLOCK_COUNT_INDEX = 4;
const BLOCK_NUMBER_INDEX = 5;

async function bootstrap(dac, operator) {
  return throwToBool(async () => {
    await dac.bootstrap(0, await dac.totalSupply.call(), 0, 2, {
      from: operator
    });
  });
}

async function createProposal(dac, operator, args) {
  return await throwToBool(async () => {
    await dac.createProposal(...args, {
      from: operator
    });
  });
}

async function applyProposal(dac, operator) {
  return await throwToBool(async () => {
    await dac.applyProposal({
      from: operator
    });
  });
}

/**
 * Catch any thrown value and return false instead
 **/
async function throwToBool(fn, ...args) {
  let thrown = false;
  try {
    await fn(...args);
  } catch (err) {
    thrown = true;
  } finally {
    return !thrown;
  }
}

async function waitForBlock(num) {
  while (web3.eth.blockNumber < +num) {
    await new Promise(r => setTimeout(r, 200));
  }
}

async function votingEndBlock(dac) {
  const votingBlockCount = await dac.votingBlockCount.call();
  const proposal = await activeProposal(dac);
  return +proposal[BLOCK_NUMBER_INDEX] + +votingBlockCount;
}

async function activeProposal(dac) {
  const proposalNumber = await dac.proposalNumber.call();
  return await dac.proposals.call(proposalNumber);
}

contract('BlockLeaseDAC', (accounts) => {

  it('should fail to create proposal from non operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(!await bootstrap(dac, accounts[1]));
    assert(!await createProposal(dac, accounts[1], [
      200000000, // tokensForSale
      200000, // tokensPerEth
      200000000, // bonusPool
      200000000, // devPool
      60000 // votingBlockCount
    ]));
  });

  it('should create first proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(await createProposal(dac, accounts[0], [
      200000000, // tokensForSale
      200000, // tokensPerEth
      200000000, // bonusPool
      200000000, // devPool
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
    const devPool = await dac.devPool.call();
    assert.equal(tokensForSale.toString(), proposal[TOKENS_FOR_SALE_INDEX].toString(), 'Tokens for sale is incorrect');
    assert.equal(tokensPerEth.toString(), proposal[TOKENS_PER_ETH_INDEX].toString(), 'Tokens per eth is incorrect');
    assert.equal(bonusPool.toString(), proposal[BONUS_POOL_INDEX].toString(), 'Bonus pool is incorrect');
    assert.equal(devPool.toString(), proposal[DEV_POOL_INDEX].toString(), 'Dev pool is incorrect');
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

  it('should fail to create proposal with lower devPool value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[DEV_POOL_INDEX] = +proposal[DEV_POOL_INDEX] - 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Decreased bonusPool in proposal'));
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

});
