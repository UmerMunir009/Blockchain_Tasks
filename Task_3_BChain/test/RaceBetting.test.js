const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RaceBettingMarket System", function () {
  let Oracle, oracle;
  let Market, market;
  let GRNY, GRNN;
  let owner, addr1, addr2;

  const INITIAL_LIQUIDITY = ethers.parseEther("0.1");
  const BET_AMOUNT = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    //  Deploy Oracle
    Oracle = await ethers.getContractFactory("OracleCon");
    oracle = await Oracle.deploy();

    //  Deploy Market
    Market = await ethers.getContractFactory("RaceBettingMarket");
    market = await Market.deploy(await oracle.getAddress(), { value: INITIAL_LIQUIDITY });

    //  Connect to Token Contracts
    const grnyAddress = await market.greenYesToken();
    const grnnAddress = await market.greenNoToken();
    GRNY = await ethers.getContractAt("OutcomeToken", grnyAddress);
    GRNN = await ethers.getContractAt("OutcomeToken", grnnAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct oracle provider", async function () {
      expect(await market.resultProvider()).to.equal(await oracle.getAddress());
    });

    it("Should start with equal pool supplies", async function () {
      expect(await market.poolYes()).to.equal(await market.INITIAL_VIRTUAL_POOL());
      expect(await market.poolNo()).to.equal(await market.INITIAL_VIRTUAL_POOL());
    });
  });

  describe("Betting Logic", function () {
    it("Should mint GRNY tokens when betting Yes", async function () {
      await market.connect(addr1).betYes({ value: BET_AMOUNT });
      const balance = await GRNY.balanceOf(addr1.address);
      expect(balance).to.be.gt(0);
    });

    it("Should increase the price of Yes after a Yes bet", async function () {
      const priceBefore = await market.getYesPrice();
      await market.connect(addr1).betYes({ value: BET_AMOUNT });
      const priceAfter = await market.getYesPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });
  });

  describe("Selling Logic", function () {
    it("Should allow user to sell tokens before race ends", async function () {
      await market.connect(addr1).betYes({ value: BET_AMOUNT });
      const balanceBefore = await GRNY.balanceOf(addr1.address);
      
      await market.connect(addr1).sellYesShares(balanceBefore);
      
      const balanceAfter = await GRNY.balanceOf(addr1.address);
      expect(balanceAfter).to.equal(0);
    });
  });

  describe("Resolution and Winnings", function () {
    it("Should only allow oracle to finalize the race", async function () {
      await expect(
        market.connect(addr1).finalizeRace(true)
      ).to.be.revertedWith("NOT_AUTHORIZED_PROVIDER");
    });

    it("Should allow winners to collect payout (0.01 ETH per token)", async function () {
      // User bets
      await market.connect(addr1).betYes({ value: BET_AMOUNT });
      const tokenBalance = await GRNY.balanceOf(addr1.address);

      // Oracle reports Green (Yes) won
      await oracle.reportResult(await market.getAddress(), true);

      // Check balance change during claim
      await expect(() => market.connect(addr1).collectWinnings())
        .to.changeEtherBalance(addr1, (tokenBalance * BigInt(1e16)) / BigInt(1e18)); 
        // 1e16 = 0.01 ETH payout
    });

    it("Should prevent losers from collecting winnings", async function () {
      await market.connect(addr1).betNo({ value: BET_AMOUNT });
      await oracle.reportResult(await market.getAddress(), true); // Green wins

      await expect(
        market.connect(addr1).collectWinnings()
      ).to.be.revertedWith("NO_WINNING_SHARES_FOUND");
    });
  });
});