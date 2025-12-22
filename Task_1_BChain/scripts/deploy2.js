const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of MultihopSwapper to Sepolia...");
  
  const V2_ROUTER = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008".toLowerCase();
  const V2_FACTORY = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003".toLowerCase();
  const V3_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B91650a76488d".toLowerCase();
  const V3_FACTORY = "0x0227628f3F0236427218cf0D973D1EF552f95Bc4".toLowerCase();
  const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9".toLowerCase();

  const swapper = await ethers.deployContract("MultihopSwapper", [
    V2_ROUTER,
    V3_ROUTER,
    WETH,
    V2_FACTORY,
    V3_FACTORY
  ]);

  console.log(`Transaction submitted. Waiting for confirmation...`);

  await swapper.waitForDeployment();

  const deployedAddress = await swapper.getAddress();

  console.log("--------------------------------------------------");
  console.log(`Success! MultihopSwapper deployed to: ${deployedAddress}`);
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});