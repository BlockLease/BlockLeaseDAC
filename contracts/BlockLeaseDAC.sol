pragma solidity ^0.4.19;

interface ERC20 {
  function name() external constant returns (string _name);
  function symbol() external constant returns (string _symbol);
  function decimals() external constant returns (uint8 _decimals);
  function totalSupply() external constant returns (uint256 _totalSupply);
  function balanceOf(address _owner) external constant returns (uint256 balance);
  function transfer(address _to, uint256 _value) external returns (bool success);
  function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
  function approve(address _spender, uint256 _value) external returns (bool success);
  function allowance(address _owner, address _spender) external constant returns (uint256 remaining);

  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

contract BlockLeaseDAC is ERC20 {

  mapping (address => uint256) balances;
  mapping (address => mapping (address => uint256)) allowances;

  uint256 _totalSupply;

  function BlockLeaseDAC() public {
    _totalSupply = 100000000000;
    balances[this] = _totalSupply;
    Transfer(0x0, this, _totalSupply);
  }

  function () payable {

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
    return 18;
  }

  function totalSupply() external constant returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address _owner) external constant returns (uint256) {
    return balances[_owner];
  }

  function transfer(address _to, uint256 _value) external returns (bool) {
    if (balances[msg.sender] < _value) return false;
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    Transfer(msg.sender, _to, _value);
    return true;
  }

  function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
    if (allowances[_from][msg.sender] < _value) return false;
    if (balances[_from] < _value) return false;
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
