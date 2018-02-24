'use strict';

const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');
const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');

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
  return +proposal[4] + +votingBlockCount;
}

async function activeProposal(dac) {
  const proposalNumber = await dac.proposalNumber.call();
  return await dac.proposals.call(proposalNumber);
}

contract('BlockLeaseDAC', (accounts) => {

  it('should fail to bootstrap from non operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(!await bootstrap(dac, accounts[1]));
  });

  it('should bootstrap', async () => {
    const dac = await BlockLeaseDAC.deployed();
    assert(await bootstrap(dac, accounts[0]), 'Error bootstrapping');

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
    assert.equal(tokensForSale.toString(), proposal[0].toString(), 'Tokens for sale is incorrect');
    assert.equal(tokensPerEth.toString(), proposal[1].toString(), 'Tokens per eth is incorrect');
    assert.equal(bonusPool.toString(), proposal[2].toString(), 'Bonus pool is incorrect');
  });

  it('should fail to create a new proposal if not operator', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    assert(!await createProposal(dac, accounts[1], proposal), 'Non-operator created proposal');
  });

  it('should fail to create proposal with lower tokensForSale value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[0] = proposal[0] - 1;
    assert(!await createProposal(dac, accounts[0], proposal), 'Decreased tokensForSale in proposal');
  });

  it('should fail to create proposal with higher tokensPerEth value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[1] = +proposal[1] + 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Increased tokensPerEth in proposal'));
  });

  it('should fail to create proposal with lower bonusPool value', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[2] = +proposal[2] - 1;
    assert(!await createProposal(dac, accounts[0], proposal, 'Decreased bonusPool in proposal'));
  });

  it('should fail to create proposal with 0 proposalVotingTime', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(dac);
    proposal[3] = 0;
    assert(!await createProposal(dac, accounts[0], proposal, 'Set proposalVotingTime to 0 in proposal'));
  });

  it('should create a proposal', async () => {
    const dac = await BlockLeaseDAC.deployed();
    const proposal = [
      100000000,
      200000,
      100000000,
      2
    ];
    assert(await createProposal(dac, accounts[0], proposal), 'Failed to create proposal');
  });

});
