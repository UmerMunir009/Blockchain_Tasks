// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract UnifiedSwapper {
    IUniswapV2Router02 public immutable v2Router;
    ISwapRouter public immutable v3Router;
    address public immutable WETH;

    constructor(address _v2Router, address _v3Router, address _weth) {
        v2Router = IUniswapV2Router02(_v2Router);
        v3Router = ISwapRouter(_v3Router);
        WETH = _weth;
    }

    enum DexVersion { V2, V3 }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        DexVersion version,
        uint24 poolFee // Only used for V3 (e.g., 3000 for 0.3%)
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(version == DexVersion.V2 ? address(v2Router) : address(v3Router), amountIn);

        if (version == DexVersion.V2) {
            amountOut = _swapV2(tokenIn, tokenOut, amountIn);
        } else {
            amountOut = _swapV3(tokenIn, tokenOut, amountIn, poolFee);
        }

        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }

    function _swapV2(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256) {
        address[] memory path = new address[](3);
        path[0] = tokenIn;
        path[1] = WETH;
        path[2] = tokenOut;

        uint[] memory amounts = v2Router.swapExactTokensForTokens(
            amountIn,
            0, // Accept any amount out (in production use a price oracle)
            path,
            address(this),
            block.timestamp
        );
        return amounts[amounts.length - 1];
    }

    function _swapV3(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) internal returns (uint256) {
        // Path: tokenIn -> fee -> WETH -> fee -> tokenOut
        bytes memory path = abi.encodePacked(tokenIn, fee, WETH, fee, tokenOut);

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0
        });

        return v3Router.exactInput(params);
    }
}