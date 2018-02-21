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

  mapping (address => bool) operators;

  mapping (address => uint256) public balances;
  mapping (address => mapping (address => uint256)) public allowances;

  uint256 public tokensForSale;
  uint256 public tokensSold;
  uint256 public tokensPerEth;

  uint256 public bonusPool = 100000000;
  uint256 public bonusesDistributed = 0;

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

  function BlockLeaseDAC() public {
    operators[msg.sender] = true;
    tokensForSale = 100000000;
    tokensPerEth = 200000;

    balances[0x0] = totalSupply();
    balances[0x0] = 0;
    balances[this] = totalSupply();
    Transfer(0x0, this, totalSupply());
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
   * Crowdfunding events happen here.
   **/
  function () public payable {
    uint256 tokenCount = tokensPerEth * msg.value;
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
      uint256 bonusTokens = tokensPerEth / 1000 * msg.value;
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
  function updateProfitBalance(address _user) public returns (bool) {
    if (lastTotalProfitCredited[_user] >= totalProfit) return;
    profitBalances[_user] = latestProfitBalance(_user);
    lastTotalProfitCredited[_user] = totalProfit;
  }

  function latestProfitBalance(address _user) public constant returns (uint256) {
    return profitBalances[_user] + (totalProfit - lastTotalProfitCredited[_user]) / totalSupply();
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
