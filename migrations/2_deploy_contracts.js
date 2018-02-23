'use strict';

const BlockLeaseDAC = artifacts.require('BlockLeaseDAC.sol');
const CrowdsaleRegistry = artifacts.require('CrowdsaleEntry.sol');

module.exports = async function(deployer) {
  const deployed = deployer.deploy(CrowdsaleRegistry);
  console.log(deployed);
  return await deployer.deploy(BlockLeaseDAC);
  // return await deployer.deploy(BlockLeaseDAC);
};
