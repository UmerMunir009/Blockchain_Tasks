const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("MultihopSwapper Logic Tests", function () {
  // Increase timeout because forking involves network requests
  this.timeout(150000);

  let swapper, dai, usdc, weth, whaleSigner;

  // Mainnet Addresses
  const V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  // A known DAI Whale
  const DAI_WHALE = "0x60FaAe176336dAb62e284Fe19B885B095d29fB7F";

  before(async () => {
    // 1. Deploy Contract
    const Swapper = await ethers.getContractFactory("MultihopSwapper");
    swapper = await Swapper.deploy(
      V2_ROUTER,
      V3_ROUTER,
      WETH,
      V2_FACTORY,
      V3_FACTORY,
      { gasPrice: ethers.parseUnits("500", "gwei") }
    );

    // 2. Token Instances
    dai = await ethers.getContractAt("IERC20", DAI);
    usdc = await ethers.getContractAt("IERC20", USDC);

    // 3. Impersonate Account
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_WHALE],
    });
    whaleSigner = await ethers.getSigner(DAI_WHALE);

    // 4. Fund Whale with ETH (for gas)
    const [admin] = await ethers.getSigners();
    await admin.sendTransaction({
      to: DAI_WHALE,
      value: ethers.parseEther("10.0"),
    });
  });

  it("Should swap DAI to USDC via V3 (Path: DAI -> WETH -> USDC)", async function () {
    const amountIn = ethers.parseUnits("1000", 18); // 1000 DAI
    await dai.connect(whaleSigner).approve(swapper.target, amountIn);

    const balBefore = await usdc.balanceOf(DAI_WHALE);

    // V3 Fee 3000 
    await expect(
      swapper
        .connect(whaleSigner)
        .swap(DAI, USDC, amountIn, 1, 3000, {
          gasPrice: ethers.parseUnits("500", "gwei"),
        })
    ).to.emit(swapper, "SwapExecuted");

    const balAfter = await usdc.balanceOf(DAI_WHALE);
    expect(balAfter).to.be.gt(balBefore);
    console.log(
      `USDC Received (V3): ${ethers.formatUnits(balAfter - balBefore, 6)}`
    );
  });

  
  it("Should swap DAI to WETH directly (Path: DAI -> WETH)", async function () {
    const amountIn = ethers.parseUnits("1000", 18);
    const wethContract = await ethers.getContractAt("IERC20", WETH);
    
    await dai.connect(whaleSigner).approve(swapper.target, amountIn);

    const balBefore = await wethContract.balanceOf(DAI_WHALE);

    //  V3, fee 3000
    await expect(
      swapper.connect(whaleSigner).swap(DAI, WETH, amountIn, 1, 3000)
    ).to.emit(swapper, "SwapExecuted");

    const balAfter = await wethContract.balanceOf(DAI_WHALE);
    expect(balAfter).to.be.gt(balBefore);
    console.log(`WETH Received: ${ethers.formatEther(balAfter - balBefore)}`);
  });
  
  it("Should revert with PoolDoesNotExistV3 for an invalid fee tier", async function () {
    const amountIn = ethers.parseUnits("1", 18);
    await dai.connect(whaleSigner).approve(swapper.target, amountIn);

    // Use a fee tier that doesn't exist (e.g., 1)
    // This will pass the transfer line but fail the Pool Existence Check
    await expect(
      swapper.connect(whaleSigner).swap(DAI, USDC, amountIn, 1, 1)
    ).to.be.revertedWithCustomError(swapper, "PoolDoesNotExistV3");
  });

  it("Should swap DAI to USDC via V2 (Path: DAI -> WETH -> USDC)", async function () {
    const amountIn = ethers.parseUnits("1000", 18);
    await dai.connect(whaleSigner).approve(swapper.target, amountIn);

    const balBefore = await usdc.balanceOf(DAI_WHALE);

    // V2 
    await swapper.connect(whaleSigner).swap(DAI, USDC, amountIn, 0, 0);

    const balAfter = await usdc.balanceOf(DAI_WHALE);
    expect(balAfter).to.be.gt(balBefore);
    console.log(
      `USDC Received (V2): ${ethers.formatUnits(balAfter - balBefore, 6)}`
    );
  });

});
