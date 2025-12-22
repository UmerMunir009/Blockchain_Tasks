// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AMMPool.sol";

contract AMMFactory {
    mapping(address => mapping(address => address)) public getPool;
    address[] public allPools;

    event PoolCreated(address indexed token0, address indexed token1, address pool, uint256);

    function createPool(address tokenA, address tokenB) external returns (address pool) {
        require(tokenA != tokenB, "Same Addresses");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPool[t0][t1] == address(0), "Pool already exists");

        AMMPool newPool = new AMMPool();
        newPool.initialize(t0, t1);

        pool = address(newPool);
        getPool[t0][t1] = pool;
        getPool[t1][t0] = pool;
        allPools.push(pool);

        emit PoolCreated(t0, t1, pool, allPools.length);
    }
}