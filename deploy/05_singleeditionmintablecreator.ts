module.exports = async ({ getNamedAccounts, deployments }: any) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const mintableAddress = (await deployments.get("SingleEditionMintable")).address;
  const seededMintableAddress = (await deployments.get("SeededSingleEditionMintable")).address;

  await deploy("SingleEditionMintableCreator", {
    from: deployer,
    args: [mintableAddress, seededMintableAddress],
    log: true,
  });
};
module.exports.tags = ["SingleEditionMintableCreator"];
module.exports.dependencies = ["SingleEditionMintable", "SeededSingleEditionMintable"];
