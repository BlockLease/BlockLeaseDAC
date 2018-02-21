'use strict';

const BlockLeaseDAC = artifacts.require('BlockLeaseDAC.sol');

module.exports = async function(deployer) {
  await deployer.deploy(BlockLeaseDAC);
};
