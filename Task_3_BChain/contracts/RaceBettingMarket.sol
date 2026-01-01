// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OutcomeToken.sol";

contract RaceBettingMarket {
    
    OutcomeToken public immutable greenYesToken; 
    OutcomeToken public immutable greenNoToken;  

    uint256 public constant WINNER_PAYOUT = 0.01 ether;
    uint256 public constant INITIAL_VIRTUAL_POOL = 100 * 1e18;

    uint256 public poolYes; 
    uint256 public poolNo;  

    address public immutable resultProvider; 
    bool public raceFinished;    
    bool public greenCarVictory; 


    event TokensPurchased(address indexed player, bool isYes, uint256 amountMinted, uint256 ethPaid);
    event TokensLiquidated(address indexed player, bool isYes, uint256 amountBurned, uint256 ethReturned);
    event RaceFinalized(bool greenWon);
    event WinningsClaimed(address indexed player, uint256 amountBurned, uint256 totalPayout);
    event ReserveFunded(uint256 fundingAmount);


    modifier onlyProvider() {
        require(msg.sender == resultProvider, "NOT_AUTHORIZED_PROVIDER");
        _;
    }

    modifier raceInProgress() {
        require(!raceFinished, "RACE_ALREADY_FINISHED");
        _;
    }

    // Initialize our contract
    constructor(address _provider) payable {
        require(_provider != address(0), "INVALID_PROVIDER_ADDRESS");
        require(msg.value >= 0.1 ether, "MINIMUM_LIQUIDITY_NOT_MET");

        resultProvider = _provider;
        emit ReserveFunded(msg.value);
        greenYesToken = new OutcomeToken("Green Car Yes", "GRNY", address(this));
        greenNoToken = new OutcomeToken("Green Car No", "GRNN", address(this));

        poolYes = INITIAL_VIRTUAL_POOL;
        poolNo = INITIAL_VIRTUAL_POOL;
    }


    // For getting current prices of tokens
    function getYesPrice() public view returns (uint256) {
        return (WINNER_PAYOUT * poolYes) / (poolYes + poolNo);
    }

    function getNoPrice() public view returns (uint256) {
        return (WINNER_PAYOUT * poolNo) / (poolYes + poolNo);
    }

    // Funtions for betting on base of yes/no tokens
    function betYes() external payable raceInProgress {
        uint256 currentPrice = getYesPrice();
        require(currentPrice > 0, "INVALID_POOL_STATE");

        uint256 tokensToMint = (msg.value * 1e18) / currentPrice;
        require(tokensToMint > 0, "BET_TOO_SMALL");

        uint256 activeLiability = (poolYes > INITIAL_VIRTUAL_POOL) ? poolYes - INITIAL_VIRTUAL_POOL : 0;
        uint256 newLiability = ((activeLiability + tokensToMint) * WINNER_PAYOUT) / 1e18;
        
        require(newLiability <= address(this).balance, "MARKET_INSOLVENT");

        poolYes += tokensToMint;
        greenYesToken.mint(msg.sender, tokensToMint);
        emit TokensPurchased(msg.sender, true, tokensToMint, msg.value);
    }

    function betNo() external payable raceInProgress {
        uint256 currentPrice = getNoPrice();
        require(currentPrice > 0, "INVALID_POOL_STATE");

        uint256 tokensToMint = (msg.value * 1e18) / currentPrice;
        require(tokensToMint > 0, "BET_TOO_SMALL");

        uint256 activeLiability = (poolNo > INITIAL_VIRTUAL_POOL) ? poolNo - INITIAL_VIRTUAL_POOL : 0;
        uint256 newLiability = ((activeLiability + tokensToMint) * WINNER_PAYOUT) / 1e18;

        require(newLiability <= address(this).balance, "MARKET_INSOLVENT");

        poolNo += tokensToMint;
        greenNoToken.mint(msg.sender, tokensToMint);
        emit TokensPurchased(msg.sender, false, tokensToMint, msg.value);
    }

    // selling tokens before race ends
    function sellYesShares(uint256 quantity) external raceInProgress {
        require(quantity > 0, "MUST_SELL_POSITIVE_AMOUNT");

        uint256 refundAmount = (quantity * getYesPrice()) / 1e18;
        require(refundAmount > 0, "VALUE_TOO_LOW_TO_SELL");

        poolYes -= quantity;
        greenYesToken.burn(msg.sender, quantity);

        (bool success,) = msg.sender.call{value: refundAmount}("");
        require(success, "REFUND_TRANSFER_FAILED");

        emit TokensLiquidated(msg.sender, true, quantity, refundAmount);
    }

    function sellNoShares(uint256 quantity) external raceInProgress {
        require(quantity > 0, "MUST_SELL_POSITIVE_AMOUNT");

        uint256 refundAmount = (quantity * getNoPrice()) / 1e18;
        require(refundAmount > 0, "VALUE_TOO_LOW_TO_SELL");

        poolNo -= quantity;
        greenNoToken.burn(msg.sender, quantity);

        (bool success,) = msg.sender.call{value: refundAmount}("");
        require(success, "REFUND_TRANSFER_FAILED");

        emit TokensLiquidated(msg.sender, false, quantity, refundAmount);
    }

    // resolve the race
    function finalizeRace(bool _greenCarWon) external onlyProvider {
        require(!raceFinished, "RACE_ALREADY_SETTLED");
        raceFinished = true;
        greenCarVictory = _greenCarWon;
        emit RaceFinalized(_greenCarWon);
    }
    
    //collecting rewards
    function collectWinnings() external {
        require(raceFinished, "RACE_NOT_YET_DECIDED");

        OutcomeToken winningAsset = greenCarVictory ? greenYesToken : greenNoToken;
        uint256 userBalance = winningAsset.balanceOf(msg.sender);
        require(userBalance > 0, "NO_WINNING_SHARES_FOUND");

        winningAsset.burn(msg.sender, userBalance);

        uint256 totalPayout = (userBalance * WINNER_PAYOUT) / 1e18;
        require(address(this).balance >= totalPayout, "VAULT_LIQUIDITY_ISSUE");

        (bool success,) = msg.sender.call{value: totalPayout}("");
        require(success, "PAYOUT_TRANSFER_FAILED");

        emit WinningsClaimed(msg.sender, userBalance, totalPayout);
    }

    receive() external payable {
        revert("PLEASE_USE_BET_FUNCTIONS");
    }
}