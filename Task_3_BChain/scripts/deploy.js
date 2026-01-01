const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Oracle = await ethers.getContractFactory("OracleCon");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("OracleCon deployed to:", oracleAddress);

  //  Deploy Market 
  const Market = await ethers.getContractFactory("RaceBettingMarket");
  const liquidity = ethers.parseEther("0.1"); 
  
  const market = await Market.deploy(oracleAddress, { value: liquidity });
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("RaceBettingMarket deployed to:", marketAddress);

  // Log Outcome Token Addresses
  console.log("Green Yes Token:", await market.greenYesToken());
  console.log("Green No Token:", await market.greenNoToken());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });