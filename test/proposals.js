'use strict';

const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');

async function bootstrap(contract, operator) {
  return throwToBool(async () => {
    await contract.bootstrap(0, await contract.totalSupply.call(), 0, 2, {
      from: operator
    });
  });
}

async function createProposal(contract, operator, args) {
  return await throwToBool(async () => {
    await contract.createProposal(...args, {
      from: operator
    });
  });
}

async function applyProposal(contract, operator) {
  return await throwToBool(async () => {
    await contract.applyProposal({
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
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function activeProposal(contract) {
  const proposalNumber = await contract.proposalNumber.call();
  return await contract.proposals.call(proposalNumber);
}

contract('BlockLeaseDAC', (accounts) => {

  it('should fail to bootstrap from non operator', async () => {
    const contract = await BlockLeaseDAC.deployed();
    assert(!await bootstrap(contract, accounts[1]));
  });

  it('should bootstrap', async () => {
    const contract = await BlockLeaseDAC.deployed();
    assert(await bootstrap(contract, accounts[0]), 'Error bootstrapping');

    const balance = await contract.balanceOf.call(contract.address);
    const totalSupply = await contract.totalSupply.call();
    assert.equal(balance.toString(), totalSupply.toString(), 'Contract balance is incorrect');
  });

  it('should fail to apply initial proposal before voting end block', async () => {
    const contract = await BlockLeaseDAC.deployed();
    assert(!await applyProposal(contract, accounts[0]));
  });

  it('should apply initial proposal', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const votingBlockCount = await contract.votingBlockCount.call();
    const proposal = await activeProposal(contract);
    const votingPeriodEndBlock = +proposal[4] + +votingBlockCount;

    console.log(`Waiting until block ${votingPeriodEndBlock} to apply initial proposal`);
    await waitForBlock(votingPeriodEndBlock); // wait an extra couple blocks to be safe
    assert(!await applyProposal(contract, accounts[1]), 'Non-operator applied proposal');
    assert(await applyProposal(contract, accounts[0]), 'Failed to apply proposal');

    const tokensForSale = await contract.tokensForSale.call();
    const tokensPerEth = await contract.tokensPerEth.call();
    const bonusPool = await contract.bonusPool.call();
    assert.equal(tokensForSale.toString(), proposal[0].toString(), 'Tokens for sale is incorrect');
    assert.equal(tokensPerEth.toString(), proposal[1].toString(), 'Tokens per eth is incorrect');
    assert.equal(bonusPool.toString(), proposal[2].toString(), 'Bonus pool is incorrect');
  });

  it('should fail to create a new proposal if not operator', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    assert(!await createProposal(contract, accounts[1], proposal), 'Non-operator created proposal');
  });

  it('should fail to create proposal with lower tokensForSale value', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    proposal[0] = proposal[0] - 1;
    assert(!await createProposal(contract, accounts[0], proposal), 'Decreased tokensForSale in proposal');
  });

  it('should fail to create proposal with higher tokensPerEth value', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    proposal[1] = +proposal[1] + 1;
    assert(!await createProposal(contract, accounts[0], proposal, 'Increased tokensPerEth in proposal'));
  });

  it('should fail to create proposal with lower bonusPool value', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    proposal[2] = +proposal[2] - 1;
    assert(!await createProposal(contract, accounts[0], proposal, 'Decreased bonusPool in proposal'));
  });

  it('should fail to create proposal with 0 proposalVotingTime', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    proposal[3] = 0;
    assert(!await createProposal(contract, accounts[0], proposal, 'Set proposalVotingTime to 0 in proposal'));
  });

  it('should create a proposal', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = [
      100000000,
      200000,
      100000000,
      2
    ];
    assert(await createProposal(contract, accounts[0], proposal), 'Failed to create proposal');
  });

});
