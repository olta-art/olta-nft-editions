module.exports = async ({ getNamedAccounts, deployments }: any) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const mintableAddress = (await deployments.get("StandardProject")).address;
  const seededMintableAddress = (await deployments.get("SeededProject")).address;

  await deploy("ProjectCreator", {
    from: deployer,
    args: [[mintableAddress, seededMintableAddress]],
    log: true,
  });
};
module.exports.tags = ["ProjectCreator"];
module.exports.dependencies = ["StandardProject", "SeededProject"];
