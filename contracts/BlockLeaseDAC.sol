pragma solidity ^0.4.19;

interface ERC20 {
  function name() external constant returns (string _name);
  function symbol() external constant returns (string _symbol);
  function decimals() external constant returns (uint8 _decimals);
  function totalSupply() public constant returns (uint _totalSupply);
  function balanceOf(address _owner) external constant returns (uint balance);
  function transfer(address _to, uint _value) external returns (bool success);
  function transferFrom(address _from, address _to, uint _value) external returns (bool success);
  function approve(address _spender, uint _value) external returns (bool success);
  function allowance(address _owner, address _spender) external constant returns (uint remaining);

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
  uint public votingBlockCount;

  /**
   * Token state variables
   **/
  uint public tokensSold;
  uint public bonusesDistributed;

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
    votingBlockCount = 5;
    balances[0x0] = totalSupply();
  }

  bool _bootstrapped = false;
  function bootstrap(
    uint _tokensForSale,
    uint _tokensPerEth,
    uint _bonusPool,
    uint _votingBlockCount
  ) public operatorOnly {
    require(!_bootstrapped);
    _transferFrom(0x0, this, totalSupply());
    createProposal(_tokensForSale, _tokensPerEth, _bonusPool, _votingBlockCount);
    _bootstrapped = true;
  }

  function withdraw(address _target, uint _amount) public operatorOnly {
    // First throw if amount is greater than balance to avoid sign issues
    require(this.balance >= _amount);
    // Then ensure we never overdraw on profit held by token owners
    require(this.balance - _amount >= profitInContract);
    _target.transfer(_amount);
  }

  /**
   * Proposal voting
   **/

  /**
   * Create a proposal to modify certain state variables
   **/
  function createProposal(
    uint _tokensForSale,
    uint _tokensPerEth,
    uint _bonusPool,
    uint _votingBlockCount
  ) public operatorOnly {
    if (!lastProposalApplied) applyProposal();
    require(!isVoteActive());
    require(_tokensForSale >= tokensForSale);
    require(_tokensPerEth <= tokensPerEth);
    require(_bonusPool >= bonusPool);
    require(_tokensForSale + _bonusPool <= totalSupply());
    require(_votingBlockCount > 0);
    if (proposals.length != 0) {
      proposalNumber++;
    }
    proposals.push(Proposal(_tokensForSale, _tokensPerEth, _bonusPool, _votingBlockCount, block.number, 0));
    lastProposalApplied = false;
  }

  /**
   * Apply a voted upon proposal
   **/
  function applyProposal() public operatorOnly {
    require(!lastProposalApplied);
    require(proposals.length > 0);
    require(!isVoteActive());
    if (proposals[proposalNumber].totalVotes < tokensSold / 2) {
      lastProposalApplied = true;
      return;
    }
    tokensForSale = proposals[proposalNumber].tokensForSale;
    tokensPerEth = proposals[proposalNumber].tokensPerEth;
    bonusPool = proposals[proposalNumber].bonusPool;
    votingBlockCount = proposals[proposalNumber].votingBlockCount;
    lastProposalApplied = true;
  }

  function isVoteActive() public constant returns (bool) {
    if (proposals.length == 0) return false;
    return (
      block.number < proposals[proposalNumber].blockNumber + votingBlockCount &&
      block.number >= proposals[proposalNumber].blockNumber
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
    require(CrowdsaleRegistry(crowdsaleRegistry).isApproved(msg.sender));
    uint tokenCount = tokensPerEth * msg.value / 10**18;
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
    uint bonusTokens = tokensPerEth / 1000 * msg.value * 10**18;
    if (bonusesDistributed + bonusTokens > bonusPool) {
      // The edge case of bonus distribution finishing
      // Pay out the remainder of the bonus pool
      uint actualBonus = bonusPool - bonusesDistributed;
      _transferFrom(this, msg.sender, actualBonus);
      bonusesDistributed = bonusPool;
    } else {
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

  function latestProfitBalance(address _user) public constant returns (uint) {
    uint owedBalance = (totalProfit - lastTotalProfitCredited[_user]) * balances[_user] / totalSupply();
    return profitBalances[_user] + owedBalance;
  }

  function withdrawProfit() public returns (bool) {
    return _withdrawProfit(msg.sender);
  }

  function _withdrawProfit(address _from) public returns (bool) {
    updateProfitBalance(_from);
    if (profitBalances[_from] <= 0) return true;
    uint balance = profitBalances[_from];
    profitInContract -= balance;
    profitBalances[_from] -= balance;
    _from.transfer(balance);
    return true;
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

  function totalSupply() public constant returns (uint) {
    return 1000000000;
  }

  function balanceOf(address _owner) external constant returns (uint) {
    return balances[_owner];
  }

  function transfer(address _to, uint _value) external returns (bool) {
    return _transferFrom(msg.sender, _to, _value);
  }

  function transferFrom(address _from, address _to, uint _value) external returns (bool) {
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

  function approve(address _spender, uint _value) external returns (bool) {
    allowances[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  function allowance(address _owner, address _spender) external constant returns (uint) {
    return allowances[_owner][_spender];
  }
}
