pragma solidity ^0.4.19;

contract CrowdsaleRegistry {

  struct CrowdsaleEntry {
    address participant;
    string encryptedEmail;
    bytes32 encryptedPhone;
    uint confirmationCode;
    bool approved;
  }

  address public _operator;

  mapping (address => CrowdsaleEntry) public participants;

  /**
   * Mapping of encrypted emails and phone numbers into booleans to prevent
   * duplicate entries
   **/
  mapping (bytes32 => bool) public registeredPhones;

  modifier operator {
    require(msg.sender == _operator);
    _;
  }

  function CrowdsaleRegistry() public {
    _operator = msg.sender;
  }

  function isApproved(address _participant) public constant returns (bool) {
    return participants[_participant].approved;
  }

  function addEntry(string _encryptedEmail, bytes32 _encryptedPhone) public {
    require(!registeredPhones[_encryptedPhone]);
    participants[msg.sender] = CrowdsaleEntry(
      msg.sender,
      _encryptedEmail,
      _encryptedPhone,
      0,
      false
    );
    registeredPhones[_encryptedPhone] = true;
  }

  function setConfirmationCode(uint _code) public {
    participants[msg.sender].confirmationCode = _code;
  }

  function approveEntry(address _participant) public operator {
    participants[_participant].approved = true;
  }

  function unapproveEntry(address _participant) public operator {
    participants[_participant].approved = false;
  }

  function updateEntry(
    address _participant,
    string _encryptedEmail,
    bytes32 _encryptedPhone,
    uint _confirmationCode,
    bool _approved
  ) public operator {
    registeredPhones[participants[_participant].encryptedPhone] = false;
    participants[msg.sender] = CrowdsaleEntry(
      _participant,
      _encryptedEmail,
      _encryptedPhone,
      _confirmationCode,
      _approved
    );
    registeredPhones[_encryptedPhone] = true;
  }

}
