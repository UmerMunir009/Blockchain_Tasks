const hre = require("hardhat");

async function main() {
  const initialSupply = 1000000; // 1 million tokens
  const token = await hre.ethers.deployContract("CustomToken", [initialSupply]);

  await token.waitForDeployment();

  console.log(`Token deployed to: ${token.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});