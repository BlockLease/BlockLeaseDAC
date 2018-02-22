'use strict';

const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');

async function bootstrap(contract, operator) {
  return throwToBool(async () => {
    await contract.bootstrap(100000000, 200000, 100000000, 2, {
      from: operator
    });
  });
}

async function createProposal(contract, operator, ...args) {
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
  do {
    if (web3.eth.blockNumber >= num) return;
  } while (await new Promise(r => setTimeout(r, 1000)));
}

async function waitForNextBlock() {
  return waitForBlock(web3.eth.blockNumber + 1);
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
    while (web3.blockNumber < votingPeriodEndBlock + 2 /* wait an extra couple blocks to be safe */) {
      await new Promise(r => setTimeout(r, 5000))
    }
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
    proposal[0] -= 1;
    assert(!await createProposal(contract, accounts[0], proposal), 'Decreased tokensForSale in proposal');
  });

  it('should fail to create proposal with higher tokensPerEth value', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const proposal = await activeProposal(contract);
    proposal[1] = +proposal[1] + 1;
    assert(!await createProposal(contract, accounts[0], proposal, 'Increased tokensPerEth in proposal'));
  });

  xit('should fail to create invalid proposals', async () => {
    const contract = await BlockLeaseDAC.deployed();
    const tokensForSale = await contract.tokensForSale.call();
    const tokensPerEth = await contract.tokensPerEth.call();
    const bonusPool = await contract.bonusPool.call();
    const proposalVotingTime = await contract.proposalVotingTime.call();
    // Testing failure conditions of createProposal
    let thrown = false;
    try {
      await contract.createProposal(
        tokensForSale - 1,
        tokensPerEth,
        bonusPool,
        proposalVotingTime,
        {
          from: accounts[0]
        }
      );
    } catch (err) {
      thrown = true;
    } finally {
      if (!thrown) throw new Error('Should fail to propose decrease in tokensForSale');
      thrown = false;
    }
    try {
      await contract.createProposal(
        tokensForSale,
        tokensPerEth - 1,
        bonusPool,
        proposalVotingTime,
        {
          from: accounts[0]
        }
      );
    } catch (err) {
      thrown = true;
    } finally {
      if (!thrown) throw new Error('Should fail to propose decrease in tokensPerEth');
      thrown = false;
    }
    try {
      await contract.createProposal(
        tokensForSale,
        tokensPerEth,
        bonusPool - 1,
        proposalVotingTime,
        {
          from: accounts[0]
        }
      );
    } catch (err) {
      thrown = true;
    } finally {
      if (!thrown) throw new Error('Should fail to propose decrease in bonusPool');
      thrown = false;
    }
    try {
      await contract.createProposal(
        tokensForSale,
        tokensPerEth,
        bonusPool,
        {
          from: accounts[1]
        }
      );
    } catch (err) {
      thrown = true;
    } finally {
      if (!thrown) throw new Error('Should fail to propose from a non-operator address');
      thrown = false;
    }
  });

});
