'use strict';

const BlockLeaseDAC = artifacts.require('./BlockLeaseDAC.sol');
const CrowdsaleRegistry = artifacts.require('./CrowdsaleRegistry.sol');

module.exports = async (deployer) => {
  // await deployer.deploy(CrowdsaleRegistry);
  await deployer.deploy(BlockLeaseDAC);
};
