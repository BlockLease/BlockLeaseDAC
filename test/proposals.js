'use strict';

const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');

async function bootstrap(contract, operator) {
  /**
   * Ensure that the totalSupply was transferred from 0x0 to the contract
   * address during construction.
   **/
  const balance = await contract.balanceOf.call(contract.address);
  const totalSupply = await contract.totalSupply.call();
  assert.equal(balance.toString(), totalSupply.toString());

  /**
   * Apply the initial proposal. Attempting to apply the proposal before the
   * end of the proposal voting time.
   *
   * This try catch verifies that functionality. Test contracts are deployed
   * with a 15 second vote time by default.
   **/
  let thrown = false;
  try {
    await contract.applyProposal({
      from: operator
    });
  } catch (err) {
    thrown = true;
  } finally {
    if (!thrown) throw new Error('Apply proposal should have failed');
  }

}

contract('BlockLeaseDAC', (accounts) => {

  it('should deploy and transfer totalSupply to contract address', async () => {
    const contract = await BlockLeaseDAC.deployed();
    await bootstrap(contract, accounts[0]);
    const contractBalance = await contract.balanceOf.call(contract.address);
    const totalSupply = await contract.totalSupply.call();
    assert.equal(contractBalance.toString(), totalSupply.toString());
    const proposal = await contract.proposals.call(0);
    while (await contract.isVoteActive.call()) {
      await new Promise(r => setTimeout(r, 5000));
    }
    await contract.applyProposal({
      from: accounts[0]
    });
    const tokensForSale = await contract.tokensForSale.call();
    const tokensPerEth = await contract.tokensPerEth.call();
    const bonusPool = await contract.bonusPool.call();
    assert.equal(tokensForSale.toString(), proposal[0].toString());
    assert.equal(tokensPerEth.toString(), proposal[1].toString());
    assert.equal(bonusPool.toString(), proposal[2].toString());
  });

  it('should fail to create a new proposal if not operator', async () => {
    const contract = await BlockLeaseDAC.deployed();
    try {
      await contract.createProposal({
        from: accounts[1]
      });
    } catch (err) {
      return;
    }
    throw new Error('Non-operator account should not create proposal');
  });

  it('should fail to create invalid proposals', async () => {
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
