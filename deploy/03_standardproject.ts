module.exports = async ({ getNamedAccounts, deployments }: any) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sharedNFTLogicAddress = (await deployments.get("SharedNFTLogic")).address;

  await deploy("StandardProject", {
    from: deployer,
    args: [
      sharedNFTLogicAddress
    ],
    log: true,
  });
};
module.exports.tags = ["StandardProject"];
module.exports.dependencies = ["SharedNFTLogic"]
