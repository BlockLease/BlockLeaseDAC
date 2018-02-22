'use strict';

const BlockLeaseDAC = artifacts.require('BlockLeaseDAC.sol');

module.exports = async function(deployer) {
  return await deployer.deploy(BlockLeaseDAC, 100000000, 200000, 100000000, 15);
  // return await deployer.deploy(BlockLeaseDAC);
};
