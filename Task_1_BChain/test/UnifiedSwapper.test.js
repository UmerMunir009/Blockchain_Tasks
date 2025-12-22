const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UnifiedSwapper Multi-hop", function () {
  let swapper, dai, usdc, impersonatedSigner;
  
  // Mainnet Addresses (For Forking)
  const V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAI_WHALE = "0x60FaAe176336dAb62e284Fe19B885B095d29fB7F"; // A random large DAI holder

  beforeEach(async () => {
    // Deploy the contract
    const Swapper = await ethers.getContractFactory("UnifiedSwapper"); //looking into artifacts for contract ABI
    swapper = await Swapper.deploy(V2_ROUTER, V3_ROUTER, WETH);

    // Get Token Contracts
    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);

    // Impersonate the Whale
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_WHALE],
    });
    impersonatedSigner = await ethers.getSigner(DAI_WHALE);

    // 4. Fund the Whale with ETH (to pay for gas during the test)
    const [admin] = await ethers.getSigners();
    await admin.sendTransaction({
      to: DAI_WHALE,
      value: ethers.parseEther("1.0"), //1 ETH to pay for gas
    });
  });

  it("Should swap DAI to USDC via Uniswap V3 (DAI -> WETH -> USDC)", async function () {
    const amountIn = ethers.parseUnits("1000", 18); // 1000 DAI
    
    // Approve the swapper contract to spend Whale's DAI
    await dai.connect(impersonatedSigner).approve(swapper.target, amountIn);

    const initialUsdcBalance = await usdc.balanceOf(DAI_WHALE);

    // Execute Swap (Version 1 = V3)
    // 3000 = 0.3% fee tier
    await swapper.connect(impersonatedSigner).swap(DAI, USDC, amountIn, 1, 3000);

    const finalUsdcBalance = await usdc.balanceOf(DAI_WHALE);
    
    console.log("V3 Swap Complete!");
    console.log(`USDC received: ${ethers.formatUnits(finalUsdcBalance - initialUsdcBalance, 6)}`);
    
    expect(finalUsdcBalance).to.be.gt(initialUsdcBalance);
  });

  it("Should swap DAI to USDC via Uniswap V2 (DAI -> WETH -> USDC)", async function () {
    const amountIn = ethers.parseUnits("1000", 18);
    await dai.connect(impersonatedSigner).approve(swapper.target, amountIn);

    const initialUsdcBalance = await usdc.balanceOf(DAI_WHALE);

    // Execute Swap (Version 0 = V2)
    await swapper.connect(impersonatedSigner).swap(DAI, USDC, amountIn, 0, 0);

    const finalUsdcBalance = await usdc.balanceOf(DAI_WHALE);
    
    console.log("V2 Swap Complete!");
    console.log(`USDC received: ${ethers.formatUnits(finalUsdcBalance - initialUsdcBalance, 6)}`);
    
    expect(finalUsdcBalance).to.be.gt(initialUsdcBalance);
  });
});