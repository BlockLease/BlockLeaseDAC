'use strict';

const Migrations = artifacts.require('Migrations.sol');

module.exports = async function(deployer) {
  return await deployer.deploy(Migrations);
};
