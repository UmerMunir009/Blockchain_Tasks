// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarket {
    function finalizeRace(bool _greenCarWon) external;
}

contract OracleCon {
    address public owner;
    
    mapping(address => bool) public isMarketResolved;
    
    event ResultReported(address indexed market, bool greenCarWon);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER_CAN_REPORT");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function reportResult(address _marketAddress, bool _greenCarWon) external onlyOwner {
        require(!isMarketResolved[_marketAddress], "RESULT_ALREADY_REPORTED");
        isMarketResolved[_marketAddress] = true;
        IMarket(_marketAddress).finalizeRace(_greenCarWon);
        emit ResultReported(_marketAddress, _greenCarWon);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "INVALID_ADDRESS");
        owner = _newOwner;
    }
}