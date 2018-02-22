'use strict';

const BlockLeaseDAC = artifacts.require('BlockLeaseDAC.sol');

module.exports = async function(deployer) {
  return await deployer.deploy(BlockLeaseDAC);
  // return await deployer.deploy(BlockLeaseDAC);
};
