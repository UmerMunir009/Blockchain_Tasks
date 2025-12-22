const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMMPool System", function () {
  let factory, pool, tokenA, tokenB, owner, addr1;

  it("Should set up the factory and create a pool", async function () {
    [owner, addr1] = await ethers.getSigners();

    // 1. Deploy two mock tokens
    const Token = await ethers.getContractFactory("CustomToken");
    tokenA = await Token.deploy(1000000); // 1M supply
    tokenB = await Token.deploy(1000000); 

    // 2. Deploy Factory
    const Factory = await ethers.getContractFactory("AMMFactory");
    factory = await Factory.deploy();

    // 3. Create a Pool for tokenA and tokenB
    await factory.createPool(tokenA.target, tokenB.target);
    const poolAddress = await factory.getPool(tokenA.target, tokenB.target);
    
    // Attach to the newly created AMMPool
    pool = await ethers.getContractAt("AMMPool", poolAddress);
    expect(poolAddress).to.not.equal(ethers.ZeroAddress);
  });

  it("Should add liquidity", async function () {
    const amount = ethers.parseEther("1000"); // 1000 tokens

    // Approve the pool to spend tokens
    await tokenA.approve(pool.target, amount);
    await tokenB.approve(pool.target, amount);

    // Add Liquidity
    await pool.addLiquidity(amount, amount);
    
    expect(await pool.reserve0()).to.equal(amount);
    expect(await pool.reserve1()).to.equal(amount);
  });

  it("Should perform a swap and generate fees", async function () {
    const swapAmount = ethers.parseEther("100");
    await tokenA.approve(pool.target, swapAmount);

    // Initial reserve before swap
    const initialReserve0 = await pool.reserve0();

    // Swap tokenA for tokenB
    await pool.swap(tokenA.target, swapAmount);

    // The reserve should now be initial + swapAmount
    expect(await pool.reserve0()).to.equal(initialReserve0 + swapAmount);
    console.log("Swap successful! Fees are now compounding in the reserves.");
  });
});