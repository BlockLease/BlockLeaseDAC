'use strict';

const throwToBool = require('./throw-to-bool');

/**
 * Constants for interacting with the Proposal struct
 **/
const TOKENS_FOR_SALE_INDEX = 0;
const TOKENS_PER_ETH_INDEX = 1;
const BONUS_POOL_INDEX = 2;
const OPERATOR_POOL_INDEX = 3;
const VOTING_BLOCK_COUNT_INDEX = 4;
const BLOCK_NUMBER_INDEX = 5;

/**
 * Async wrapper functions for contract functions.
 *
 * Returns a boolean indicating success or failure
 **/
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
 * Wait for a block in the current web3
 **/
async function waitForBlock(num) {
  while (web3.eth.blockNumber < +num) {
    await new Promise(r => setTimeout(r, 200));
  }
}

/**
 * Retrieve the voting end block from the supplied dac
 **/
async function votingEndBlock(dac) {
  const votingBlockCount = await dac.votingBlockCount.call();
  const proposal = await activeProposal(dac);
  return +proposal[BLOCK_NUMBER_INDEX] + +votingBlockCount;
}

/**
 * Get the active proposal
 *
 * Returns an array of objects, retrieve specific values using
 * the Proposal index constants
 **/
async function activeProposal(dac) {
  const proposalNumber = await dac.proposalNumber.call();
  return await dac.proposals.call(proposalNumber);
}

module.exports = {
  throwToBool,
  createProposal,
  applyProposal,
  votingEndBlock,
  waitForBlock,
  activeProposal,
  TOKENS_FOR_SALE_INDEX,
  TOKENS_PER_ETH_INDEX,
  BONUS_POOL_INDEX,
  OPERATOR_POOL_INDEX,
  VOTING_BLOCK_COUNT_INDEX,
  BLOCK_NUMBER_INDEX
};
