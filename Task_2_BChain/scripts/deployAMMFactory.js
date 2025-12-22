const hre = require("hardhat");

async function main() {
  console.log("Deploying AMMFactory...");
  const Factory = await hre.ethers.deployContract("AMMFactory");
  await Factory.waitForDeployment();
  const factoryAddress = await Factory.getAddress();
  console.log(`AMMFactory deployed to: ${factoryAddress}`);

  const MY_TOKEN = "0x4732104EdaC87f221223Db02433989643bC2B325";
  const SECOND_TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; 

  console.log("Creating first pool...");
  const tx = await Factory.createPool(MY_TOKEN, SECOND_TOKEN);
  await tx.wait();

  const poolAddress = await Factory.getPool(MY_TOKEN, SECOND_TOKEN);
  console.log(`Pool created at: ${poolAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});