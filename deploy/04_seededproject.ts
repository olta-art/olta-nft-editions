module.exports = async ({ getNamedAccounts, deployments }: any) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sharedNFTLogicAddress = (await deployments.get("SharedNFTLogic")).address;

  await deploy("SeededProject", {
    from: deployer,
    args: [
      sharedNFTLogicAddress
    ],
    log: true,
  });
};
module.exports.tags = ["SeededProject"];
module.exports.dependencies = ["SharedNFTLogic"]
