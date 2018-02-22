module.exports = {
  networks: {
    development: {
      host: '159.203.58.217',
      port: 8545,
      gas: 6013439,
      network_id: '4' // Match only rinkeby
    },
    local: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*'
    }
  }
};
