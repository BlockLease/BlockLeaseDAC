pragma solidity ^0.4.19;

interface ERC20 {
  function name() public constant returns (string _name);
  function symbol() public constant returns (string _symbol);
  function decimals() public constant returns (uint8 _decimals);
  function totalSupply() public constant returns (uint _totalSupply);
  function balanceOf(address _owner) public constant returns (uint balance);
  function transfer(address _to, uint _value) public returns (bool success);
  function transferFrom(address _from, address _to, uint _value) public returns (bool success);
  function approve(address _spender, uint _value) public returns (bool success);
  function allowance(address _owner, address _spender) public constant returns (uint remaining);

  event Transfer(address indexed _from, address indexed _to, uint _value);
  event Approval(address indexed _owner, address indexed _spender, uint _value);
}

interface CrowdsaleRegistry {
  function isApproved(address _participant) public constant returns (bool);
}

interface DAC {
  event Profit(address indexed _from, uint _value, uint _totalProfit, uint _profitInContract);
  function pay() external payable;
}

contract BlockLeaseDAC is ERC20, DAC {

  struct Proposal {
    uint tokensForSale;
    uint tokensPerEth;
    uint bonusPool;
    uint operatorPool;
    uint votingBlockCount;
    uint blockNumber;
    uint totalVotes;
  }

  /**
   * Operators
   **/
  mapping (address => bool) public operators;

  /**
   * ERC20 state
   **/
  mapping (address => uint) balances;
  mapping (address => mapping (address => uint)) allowances;

  /**
   * Customizable variables by proposal
   **/
  uint public tokensForSale;
  uint public tokensPerEth;
  uint public bonusPool;
  uint public operatorPool;
  uint public votingBlockCount;

  /**
   * Token state variables
   **/
  uint public tokensSold;
  uint public bonusTokensDistributed;
  uint public operatorTokensDistributed;

  uint public proposalNumber;
  Proposal[] public proposals;
  mapping (uint => mapping (address => uint)) votesPerProposal;
  bool public lastProposalApplied;

  /**
   * Total profit ever received (in wei).
   **/
  uint public totalProfit;

  /**
   * Total profit that has yet to be withdrawn (in wei).
   **/
  uint public profitInContract;

  /**
   * The last totalProfit value that was paid out to the address.
   *
   * Every time an address token balance changes this is updated.
   **/
  mapping (address => uint) lastTotalProfitCredited;

  /**
   * Profits available for withdrawal
   **/
  mapping (address => uint) profitBalances;

  /**
   * The address of the crowdsale registry contract
   *
   * @TODO implement
   **/
  address public crowdsaleRegistry;

  modifier operatorOnly() {
    require(operators[msg.sender]);
    _;
  }

  /**
   * Constructor
   **/
  function BlockLeaseDAC(/* address _crowdsaleRegistry */) public {
    operators[msg.sender] = true;
    /* crowdsaleRegistry = _crowdsaleRegistry; */
    lastProposalApplied = true;
    tokensPerEth = totalSupply();
    votingBlockCount = 3;
    proposals.push(
      Proposal(tokensForSale, tokensPerEth, bonusPool, operatorPool, votingBlockCount, 0, 0)
    );
    balances[0x0] = totalSupply();
    _transferFrom(0x0, this, totalSupply());
  }

  /**
   * Withdraw funds from the contract for use
   **/
  function withdraw(address _target, uint _amount) public operatorOnly {
    // First throw if amount is greater than balance to avoid sign issues
    require(this.balance >= _amount);
    // Then ensure we never overdraw on profit held by token owners
    require(this.balance - _amount >= profitInContract);
    _target.transfer(_amount);
  }

  /**
   * Create a proposal to modify certain state variables
   **/
  function createProposal(
    uint _tokensForSale,
    uint _tokensPerEth,
    uint _bonusPool,
    uint _operatorPool,
    uint _votingBlockCount
  ) public operatorOnly {
    if (!lastProposalApplied) applyProposal();
    require(!isVoteActive());
    require(_tokensForSale >= tokensForSale);
    require(_tokensPerEth <= tokensPerEth);
    require(_bonusPool >= bonusPool);
    require(_operatorPool >= operatorPool);
    require(_tokensForSale + _bonusPool + _operatorPool <= totalSupply());
    require(_votingBlockCount > 1);

    proposalNumber++;
    proposals.push(Proposal(_tokensForSale, _tokensPerEth, _bonusPool, _operatorPool, _votingBlockCount, block.number, 0));
    lastProposalApplied = false;
  }

  /**
   * Apply a voted upon proposal
   **/
  function applyProposal() public operatorOnly {
    require(!isVoteActive());
    require(!lastProposalApplied);
    if (proposals[proposalNumber].totalVotes >= circulatingSupply() / 2) {
      tokensForSale = proposals[proposalNumber].tokensForSale;
      tokensPerEth = proposals[proposalNumber].tokensPerEth;
      bonusPool = proposals[proposalNumber].bonusPool;
      operatorPool = proposals[proposalNumber].operatorPool;
      votingBlockCount = proposals[proposalNumber].votingBlockCount;
    }
    lastProposalApplied = true;
  }

  function isVoteActive() public constant returns (bool) {
    return (
      block.number >= proposals[proposalNumber].blockNumber &&
      block.number < proposals[proposalNumber].blockNumber + votingBlockCount
    );
  }

  function vote() public {
    require(isVoteActive());
    uint previousVote = votesPerProposal[proposalNumber][msg.sender];
    proposals[proposalNumber].totalVotes -= previousVote;
    votesPerProposal[proposalNumber][msg.sender] = balances[msg.sender];
    proposals[proposalNumber].totalVotes += balances[msg.sender];
  }

  function updateVotes(address _from) public {
    if (!isVoteActive()) return;
    if (votesPerProposal[proposalNumber][_from] <= balances[_from]) return;
    votesPerProposal[proposalNumber][_from] = balances[_from];
  }

  /**
   * Crowdfunding events happen here.
   **/
  function () public payable {
    /* require(CrowdsaleRegistry(crowdsaleRegistry).isApproved(msg.sender)); */
    require(msg.value >= minimumPurchaseWei());
    uint tokenCount = tokensPerEth * msg.value / 10**18;
    require(tokensSold + tokenCount <= tokensForSale);
    _transferFrom(this, msg.sender, tokenCount);
  }

  /**
   * The minimum purchase is the cost of 1 token, in wei
   **/
  function minimumPurchaseWei() public constant returns (uint) {
    require(tokensPerEth > 0);
    return 10**18 / tokensPerEth;
  }

  /**
   * BlockLeaseDAC profits are received here.
   **/
  function pay() external payable {
    totalProfit += msg.value;
    profitInContract += msg.value;
    Profit(msg.sender, msg.value, totalProfit, profitInContract);
    if (bonusTokensDistributed >= bonusPool) return;
    uint bonusTokens = tokensPerEth / 100 * msg.value * 10**18;
    if (bonusTokensDistributed + bonusTokens > bonusPool) {
      // The edge case of bonus distribution finishing
      // Pay out the remainder of the bonus pool
      uint actualBonus = bonusPool - bonusTokensDistributed;
      _transferFrom(this, msg.sender, actualBonus);
      bonusTokensDistributed = bonusPool;
    } else {
      _transferFrom(this, msg.sender, bonusTokens);
      bonusTokensDistributed += bonusTokens;
    }
  }

  /**
   * Update the profit for a given address based on the total sent to the profit
   * function.
   *
   * This should be called prior to every token transfer to ensure that profit
   * is continuously proportionately settled to token holders.
   **/
  function updateProfitBalance(address _user) public {
    if (lastTotalProfitCredited[_user] >= totalProfit) return;
    profitBalances[_user] = latestProfitBalance(_user);
    lastTotalProfitCredited[_user] = totalProfit;
  }

  /**
   * Retrieve the up to date profit balance without mutating state
   **/
  function latestProfitBalance(address _user) public constant returns (uint) {
    uint owedBalance = (totalProfit - lastTotalProfitCredited[_user]) * balances[_user] / circulatingSupply();
    return profitBalances[_user] + owedBalance;
  }

  /**
   * Helper method to withdraw
   **/
  function withdrawProfit() public returns (bool) {
    return _withdrawProfit(msg.sender);
  }

  /**
   * Withdraw Ethereum dividends
   **/
  function _withdrawProfit(address _from) public returns (bool) {
    updateProfitBalance(_from);
    if (profitBalances[_from] <= 0) return true;
    uint balance = profitBalances[_from];
    profitInContract -= balance;
    profitBalances[_from] -= balance;
    _from.transfer(balance);
    return true;
  }

  function circulatingSupply() public constant returns (uint) {
    return tokensSold + bonusTokensDistributed + operatorTokensDistributed;
  }

  /**
   * ERC20 Implementation
   **/

  function name() public constant returns (string) {
    return 'BlockLease';
  }

  function symbol() public constant returns (string) {
    return 'LEASE';
  }

  function decimals() public constant returns (uint8) {
    return 8;
  }

  function totalSupply() public constant returns (uint) {
    return 1000000000;
  }

  function balanceOf(address _owner) public constant returns (uint) {
    return balances[_owner];
  }

  function transfer(address _to, uint _value) public returns (bool) {
    return _transferFrom(msg.sender, _to, _value);
  }

  function transferFrom(address _from, address _to, uint _value) public returns (bool) {
    require(allowances[_from][msg.sender] >= _value);
    allowances[_from][msg.sender] -= _value;
    return _transferFrom(_from, _to, _value);
  }

  function _transferFrom(address _from, address _to, uint _value) private returns (bool) {
    require(balances[_from] >= _value);
    updateProfitBalance(_from);
    updateProfitBalance(_to);
    balances[_from] -= _value;
    balances[_to] += _value;
    Transfer(_from, _to, _value);
    updateVotes(_from);
    updateVotes(_to);
    return true;
  }

  function approve(address _spender, uint _value) public returns (bool) {
    allowances[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  function allowance(address _owner, address _spender) public constant returns (uint) {
    return allowances[_owner][_spender];
  }
}
