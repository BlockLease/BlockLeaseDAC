'use strict';

const BlockLeaseDAC = artifacts.require('BlockLeaseDAC.sol');
const CrowdsaleRegistry = artifacts.require('CrowdsaleRegistry.sol');

module.exports = async function(deployer) {
  const registry = await CrowdsaleRegistry.deployed();
  return await deployer.deploy(BlockLeaseDAC, registry.address);
};
