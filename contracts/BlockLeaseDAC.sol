pragma solidity ^0.4.19;

interface ERC20 {
  function name() external constant returns (string _name);
  function symbol() external constant returns (string _symbol);
  function decimals() external constant returns (uint8 _decimals);
  function totalSupply() public constant returns (uint256 _totalSupply);
  function balanceOf(address _owner) external constant returns (uint256 balance);
  function transfer(address _to, uint256 _value) external returns (bool success);
  function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
  function approve(address _spender, uint256 _value) external returns (bool success);
  function allowance(address _owner, address _spender) external constant returns (uint256 remaining);

  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

interface DAC {
  event Profit(address indexed _from, uint256 _value, uint256 _totalProfit, uint256 _profitInContract);
  function pay() external payable;
}

contract BlockLeaseDAC is ERC20, DAC {

  struct Proposal {
    uint256 tokensForSale;
    uint256 tokensPerEth;
    uint256 bonusPool;
    uint256 proposalVotingTime;
    uint256 timestamp;
    uint256 totalVotes;
  }

  mapping (address => bool) public operators;

  mapping (address => uint256) balances;
  mapping (address => mapping (address => uint256)) allowances;

  uint256 public tokensForSale;
  uint256 public tokensSold;
  uint256 public tokensPerEth;

  uint256 public bonusPool;
  uint256 public bonusesDistributed;

  uint256 public proposalNumber;
  Proposal[] public proposals;
  mapping (uint256 => mapping (address => uint256)) votesPerProposal;
  bool lastProposalApplied;

  // 14 days
  uint256 public proposalVotingTime;

  /**
   * DAC Profit Management
   **/

  // The total amount sent to the profit function
  uint256 public totalProfit;
  uint256 public profitInContract;

  // The last totalProfit value that was paid out to the address
  mapping (address => uint256) lastTotalProfitCredited;

  // Profit balances available for withdrawal
  mapping (address => uint256) profitBalances;

  /**
   * Constructor
   **/
  function BlockLeaseDAC(
    uint256 _tokensForSale,
    uint256 _tokensPerEth,
    uint256 _bonusPool,
    uint256 _proposalVotingTime
  ) public {
    operators[msg.sender] = true;
    lastProposalApplied = true;
    balances[0x0] = totalSupply();
    proposalVotingTime = 15;
    createProposal(_tokensForSale, _tokensPerEth, _bonusPool, _proposalVotingTime);
    require(_transferFrom(0x0, this, totalSupply()));
  }

  function withdraw(address _target, uint256 _amount) public {
    require(operators[msg.sender]);
    // First throw if amount is greater than balance to avoid sign issues
    require(this.balance >= _amount);
    // Then ensure we never overdraw on profit held by token owners
    require(this.balance - _amount >= profitInContract);
    _target.transfer(_amount);
  }

  /**
   * Proposal voting
   **/

  function applyProposal() public {
    if (lastProposalApplied) return;
    require(operators[msg.sender]);
    require(proposals.length > 0);
    require(!isVoteActive());
    require(proposals[proposalNumber].totalVotes >= tokensSold / 2);
    tokensForSale = proposals[proposalNumber].tokensForSale;
    tokensPerEth = proposals[proposalNumber].tokensPerEth;
    bonusPool = proposals[proposalNumber].bonusPool;
    proposalVotingTime = proposals[proposalNumber].proposalVotingTime;
    lastProposalApplied = true;
  }

  function isVoteActive() public constant returns (bool) {
    if (proposals.length == 0) return false;
    return block.timestamp < proposals[proposalNumber].timestamp + proposalVotingTime;
  }

  function createProposal(uint256 _tokensForSale, uint256 _tokensPerEth, uint256 _bonusPool, uint256 _proposalVotingTime) public {
    applyProposal();
    require(!isVoteActive());
    require(operators[msg.sender]);
    require(_tokensForSale >= tokensForSale);
    require(_tokensPerEth >= tokensPerEth);
    require(_bonusPool >= bonusPool);
    require(_tokensForSale + _bonusPool <= totalSupply());
    /* require(_proposalVotingTime >= 60 * 60 * 24 * 14); */
    if (proposals.length != 0) {
      proposalNumber++;
    }
    proposals.push(Proposal(_tokensForSale, _tokensPerEth, _bonusPool, _proposalVotingTime, block.timestamp, 0));
    lastProposalApplied = false;
  }

  function vote() public {
    require(isVoteActive());
    uint256 previousVote = votesPerProposal[proposalNumber][msg.sender];
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
    uint256 tokenCount = tokensPerEth * msg.value/ 10**18;
    require(tokensSold + tokenCount <= tokensForSale);
    _transferFrom(this, msg.sender, tokenCount);
  }

  /**
   * BlockLeaseDAC profits are received here.
   **/
  function pay() external payable {
    totalProfit += msg.value;
    profitInContract += msg.value;
    Profit(msg.sender, msg.value, totalProfit, profitInContract);
    if (bonusesDistributed >= bonusPool) return;
    if (bonusesDistributed + bonusTokens > bonusPool) {
      // The edge case of bonus distribution finishing
      // Pay out the remainder of the bonus pool
      uint256 actualBonus = bonusPool - bonusesDistributed;
      _transferFrom(this, msg.sender, actualBonus);
      bonusesDistributed = bonusPool;
    } else {
      uint256 bonusTokens = tokensPerEth / 1000 * msg.value * 10**18;
      _transferFrom(this, msg.sender, bonusTokens);
      bonusesDistributed += bonusTokens;
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

  function latestProfitBalance(address _user) public constant returns (uint256) {
    uint256 owedBalance = (totalProfit - lastTotalProfitCredited[_user]) * balances[_user] / totalSupply();
    return profitBalances[_user] + owedBalance;
  }

  function withdrawProfit() public returns (bool) {
    return _withdrawProfit(msg.sender);
  }

  function _withdrawProfit(address _from) public returns (bool) {
    updateProfitBalance(_from);
    if (profitBalances[_from] > 0) {
      uint256 balance = profitBalances[_from];
      profitInContract -= balance;
      profitBalances[_from] -= balance;
      return _from.send(balance);
    } else {
      return true;
    }
  }

  /**
   * ERC20 Implementation
   **/

  function name() external constant returns (string) {
    return 'BlockLease';
  }

  function symbol() external constant returns (string) {
    return 'LEASE';
  }

  function decimals() external constant returns (uint8) {
    return 8;
  }

  function totalSupply() public constant returns (uint256) {
    return 1000000000;
  }

  function balanceOf(address _owner) external constant returns (uint256) {
    return balances[_owner];
  }

  function transfer(address _to, uint256 _value) external returns (bool) {
    return _transferFrom(msg.sender, _to, _value);
  }

  function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
    require(allowances[_from][msg.sender] >= _value);
    allowances[_from][msg.sender] -= _value;
    return _transferFrom(_from, _to, _value);
  }

  function _transferFrom(address _from, address _to, uint256 _value) private returns (bool) {
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

  function approve(address _spender, uint256 _value) external returns (bool) {
    allowances[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  function allowance(address _owner, address _spender) external constant returns (uint256) {
    return allowances[_owner][_spender];
  }
}
