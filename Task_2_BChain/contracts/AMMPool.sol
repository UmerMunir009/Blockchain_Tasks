// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AMMPool {
    using SafeERC20 for IERC20;

    address public factory;
    address public token0;
    address public token1;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalShares;
    mapping(address => uint256) public liquidityShares;

    uint256 public constant SWAP_FEE = 30; 
    uint256 public constant FEE_DENOMINATOR = 10000;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1, uint256 shares);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(address indexed sender, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor() {
        factory = msg.sender;
    }

    // Called once by factory to set up the pair
    function initialize(address _t0, address _t1) external {
        require(msg.sender == factory, "Only Factory");
        token0 = _t0;
        token1 = _t1;
    }

    /* ========== LIQUIDITY (STAKING) ========== */

    function addLiquidity(uint256 amount0, uint256 amount1) external returns (uint256 shares) {
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        if (totalShares == 0) {
            shares = _sqrt(amount0 * amount1);
        } else {
            shares = _min(
                (amount0 * totalShares) / reserve0,
                (amount1 * totalShares) / reserve1
            );
        }

        require(shares > 0, "Insufficient liquidity minted");
        liquidityShares[msg.sender] += shares;
        totalShares += shares;
        reserve0 += amount0;
        reserve1 += amount1;

        emit Mint(msg.sender, amount0, amount1, shares);
    }

    function removeLiquidity(uint256 shares) external returns (uint256 amount0, uint256 amount1) {
        require(liquidityShares[msg.sender] >= shares, "Insufficient shares");

        amount0 = (reserve0 * shares) / totalShares;
        amount1 = (reserve1 * shares) / totalShares;

        liquidityShares[msg.sender] -= shares;
        totalShares -= shares;
        reserve0 -= amount0;
        reserve1 -= amount1;

        IERC20(token0).safeTransfer(msg.sender, amount0);
        IERC20(token1).safeTransfer(msg.sender, amount1);

        emit Burn(msg.sender, amount0, amount1, shares);
    }

    /* ========== SWAPPING (REWARD GENERATION) ========== */

    function swap(address tokenInAddress, uint256 amountIn) external returns (uint256 amountOut) {
        require(tokenInAddress == token0 || tokenInAddress == token1, "Invalid token");
        bool isToken0 = tokenInAddress == token0;

        (IERC20 tIn, IERC20 tOut) = isToken0 ? (IERC20(token0), IERC20(token1)) : (IERC20(token1), IERC20(token0));
        (uint256 resIn, uint256 resOut) = isToken0 ? (reserve0, reserve1) : (reserve1, reserve0);

        tIn.safeTransferFrom(msg.sender, address(this), amountIn);

        // Calculate fee-adjusted amount
        uint256 amountInWithFee = (amountIn * (FEE_DENOMINATOR - SWAP_FEE)) / FEE_DENOMINATOR;
        amountOut = (resOut * amountInWithFee) / (resIn + amountInWithFee);

        require(amountOut > 0, "Insufficient output amount");

        if (isToken0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        tOut.safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, tokenInAddress, amountIn, amountOut);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    function _min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}