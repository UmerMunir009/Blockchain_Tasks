const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to Sepolia...");

  // Using lowercase strings bypasses the Ethers checksum validation
  const V2_ROUTER = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008".toLowerCase(); 
  const V3_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B91650a76488d".toLowerCase();
  const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9".toLowerCase();

  const swapper = await ethers.deployContract("UnifiedSwapper", [
    V2_ROUTER, 
    V3_ROUTER, 
    WETH
  ]);

  await swapper.waitForDeployment();

  console.log(` Success! UnifiedSwapper deployed to: ${swapper.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});