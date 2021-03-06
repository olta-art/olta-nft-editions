import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import parseDataURI from "data-urls";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ProjectCreator,
  StandardProject,
} from "../typechain";

import {
  projectData,
  Implementation,
  Label
} from "./utils"

describe("StandardProject", () => {
  let signer: SignerWithAddress;
  let signerAddress: string;
  let dynamicSketch: ProjectCreator;

  beforeEach(async () => {
    const { ProjectCreator } = await deployments.fixture([
      "ProjectCreator",
      "StandardProject",
    ]);
    const dynamicMintableAddress = (
      await deployments.get("StandardProject")
    ).address;
    dynamicSketch = (await ethers.getContractAt(
      "ProjectCreator",
      ProjectCreator.address
    )) as ProjectCreator;

    signer = (await ethers.getSigners())[0];
    signerAddress = await signer.getAddress();
  });

  it("purchases a edition", async () => {
    await dynamicSketch.createProject(
      projectData(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        {
          urls: [
            {
              url: "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
              sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
            },
            {
              url: "",
              sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            }
          ],
          label: [0,0,1]
        },
        10,
        10
      ),
      Implementation.standard
    );

    const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.standard);
    const minterContract = (await ethers.getContractAt(
      "StandardProject",
      editionResult
    )) as StandardProject;
    expect(await minterContract.name()).to.be.equal("Testing Token");
    expect(await minterContract.symbol()).to.be.equal("TEST");

    const [_, s2] = await ethers.getSigners();
    await expect(minterContract.purchase()).to.be.revertedWith("Not for sale");
    await expect(
      minterContract.connect(s2).setSalePrice(ethers.utils.parseEther("0.2"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    expect(
      await minterContract.setSalePrice(ethers.utils.parseEther("0.2"))
    ).to.emit(minterContract, "PriceChanged");
    expect(
      await minterContract
        .connect(s2)
        .purchase({ value: ethers.utils.parseEther("0.2") })
    ).to.emit(minterContract, "EditionSold");
    const signerBalance = await signer.getBalance();
    await minterContract.withdraw();
    // Some ETH is lost from withdraw contract interaction.
    expect(
      (await signer.getBalance())
        .sub(signerBalance)
        .gte(ethers.utils.parseEther('0.19'))
    ).to.be.true;
  });
});
