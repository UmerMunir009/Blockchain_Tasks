// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

contract MultihopSwapper is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public immutable v2Router;
    ISwapRouter public immutable v3Router;
    address public immutable WETH;
    
    address public immutable v2Factory;
    address public immutable v3Factory;

    uint256 public constant DEADLINE_BUFFER = 20 minutes;

    enum DexVersion { V2, V3 }

    error PoolDoesNotExistV3(address tokenIn, address tokenOut, uint24 fee);
    error PoolDoesNotExistV2(address tokenIn, address tokenOut);

    event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, DexVersion dex);

    constructor(
        address _v2Router, 
        address _v3Router, 
        address _weth,
        address _v2Factory,
        address _v3Factory
    ) Ownable(msg.sender) {
        v2Router = IUniswapV2Router02(_v2Router);
        v3Router = ISwapRouter(_v3Router);
        WETH = _weth;
        v2Factory = _v2Factory;
        v3Factory = _v3Factory;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        DexVersion version,
        uint24 poolFee
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Same tokens");
        require(amountIn > 0, "Zero amount");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        if (version == DexVersion.V2) {
            amountOut = _swapV2(tokenIn, tokenOut, amountIn);
        } else {
            amountOut = _swapV3(tokenIn, tokenOut, amountIn, poolFee);
        }

        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, version);
    }

    function _swapV2(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256) {
        if (tokenIn != WETH && tokenOut != WETH) {
            if (IUniswapV2Factory(v2Factory).getPair(tokenIn, WETH) == address(0)) revert PoolDoesNotExistV2(tokenIn, WETH);
            if (IUniswapV2Factory(v2Factory).getPair(WETH, tokenOut) == address(0)) revert PoolDoesNotExistV2(WETH, tokenOut);
        } else {
            if (IUniswapV2Factory(v2Factory).getPair(tokenIn, tokenOut) == address(0)) revert PoolDoesNotExistV2(tokenIn, tokenOut);
        }

        address[] memory path;
        if (tokenIn == WETH || tokenOut == WETH) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
        } else {
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = WETH;
            path[2] = tokenOut;
        }

        IERC20(tokenIn).forceApprove(address(v2Router), amountIn);
        
        uint256[] memory amounts = v2Router.swapExactTokensForTokens(
            amountIn, 0, path, address(this), block.timestamp + DEADLINE_BUFFER
        );
        return amounts[amounts.length - 1];
    }

    function _swapV3(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) internal returns (uint256) {
        if (tokenIn != WETH && tokenOut != WETH) {
            if (IUniswapV3Factory(v3Factory).getPool(tokenIn, WETH, fee) == address(0)) revert PoolDoesNotExistV3(tokenIn, WETH, fee);
            if (IUniswapV3Factory(v3Factory).getPool(WETH, tokenOut, fee) == address(0)) revert PoolDoesNotExistV3(WETH, tokenOut, fee);
        } else {
            if (IUniswapV3Factory(v3Factory).getPool(tokenIn, tokenOut, fee) == address(0)) revert PoolDoesNotExistV3(tokenIn, tokenOut, fee);
        }

        IERC20(tokenIn).forceApprove(address(v3Router), amountIn);
        
        if (tokenIn == WETH || tokenOut == WETH) {
            return v3Router.exactInputSingle(ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + DEADLINE_BUFFER,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            }));
        } else {
            bytes memory path = abi.encodePacked(tokenIn, fee, WETH, fee, tokenOut);
            return v3Router.exactInput(ISwapRouter.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp + DEADLINE_BUFFER,
                amountIn: amountIn,
                amountOutMinimum: 0 
            }));
        }
    }
}