import { expect } from "chai";
// import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import parseDataURI from "data-urls";

import {
  ProjectCreator,
  StandardProject,
  SeededProject
} from "../typechain";

import {
  projectData,
  Implementation,
  Label
} from "./utils"


const defaultVersion = () => {
  return {
    urls: [
      // image
      {
        url: "",
        sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      },
      // animation
      {
        url: "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
        sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
    ],
    label: [0,0,1] as Label
  }
}

const defualtProjectData = projectData(
  "Testing Token",
  "TEST",
  "This is a testing token for all",
  defaultVersion(),
  10,
  10
)

describe("ProjectCreator", () => {
  let signer: SignerWithAddress;
  let signerAddress: string;
  let creatorContract: ProjectCreator;

  beforeEach(async () => {
    const { ProjectCreator } = await deployments.fixture([
      "ProjectCreator",
      "StandardProject",
    ]);

    creatorContract = (await ethers.getContractAt(
      "ProjectCreator",
      ProjectCreator.address
    )) as ProjectCreator

    signer = (await ethers.getSigners())[0]
    signerAddress = await signer.getAddress()
  })

  describe("#createProject", () => {
    it("creates new edition with StandardProject implementation", async () => {
      await creatorContract.createProject(
        defualtProjectData,
        Implementation.standard
      )
      const editionConractAddress01 = await creatorContract.getProjectAtId(0, Implementation.standard)
      const editionsContract01 = (await ethers.getContractAt(
        "StandardProject",
        editionConractAddress01
      )) as StandardProject;

      // check supports StandardProject interface
      expect(
        await editionsContract01.supportsInterface("0x2fc51e5a")
      ).to.be.true
    })

    it("creates new edition with seededProject implementation", async () => {
      await creatorContract.createProject(
        defualtProjectData,
        Implementation.seeded
      )
      const editionConractAddress02 = await creatorContract.getProjectAtId(0, Implementation.seeded)
      const editionsContract02 = (await ethers.getContractAt(
        "SeededProject",
        editionConractAddress02
      )) as SeededProject;

      // check supports SeededProject interface
      expect(
        await editionsContract02.supportsInterface("0x26057e5e")
      ).to.be.true
    })

    it("should increment a seperate id counter for each implementation", async () => {

       // create first edition
      await creatorContract.createProject(
        defualtProjectData,
        Implementation.standard
      )

      // create second edition
      let expectedAddress = await creatorContract.getProjectAtId(1, Implementation.standard)
      await expect(
        creatorContract.createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.emit(
        creatorContract,
        "CreatedProject"
      ).withArgs(
          1,                // id
          signerAddress,    // creator
          10,               // edition size
          expectedAddress,
          Implementation.standard
        )

      // create first seeded edition
      expectedAddress = await creatorContract.getProjectAtId(0, Implementation.seeded)
      await expect(
        creatorContract.createProject(
          defualtProjectData,
          Implementation.seeded
        )
      ).to.emit(
        creatorContract,
        "CreatedProject"
      ).withArgs(
          0,              // id
          signerAddress,  // creator
          10,             // edition size
          expectedAddress,
          Implementation.seeded
        )
    })
    it("reverts if implementation doesn't exist", async () => {
      await expect(
        creatorContract.createProject(
          defualtProjectData,
          3
        )
      ).to.be.revertedWith("implementation does not exist")
    })
  })

  describe("#addImplementation", () => {
    let newImplementation: StandardProject

    const deployImplementation = async (s = signer) => {
      // deploy another Standard Project contract
      const { SharedNFTLogic } = await deployments.fixture(["SharedNFTLogic"])
      const StandardProject = await ethers.getContractFactory("StandardProject")
      const standardProject = await StandardProject.connect(s).deploy(SharedNFTLogic.address)
      await standardProject.connect(s).deployed()

      return standardProject as StandardProject
    }

    beforeEach(async () => {
      newImplementation = await deployImplementation()
    })

    it("reverts if not deployer of contract", async () => {
      const notOwner = (await ethers.getSigners())[1]
      await expect(
        creatorContract.connect(notOwner).addImplementation(newImplementation.address)
      ).to.be.revertedWith("Only owner can call this function.")
    })

    it("adds an implementation", async () => {
      await creatorContract.addImplementation(newImplementation.address)
      expect(
        await creatorContract.implementations(2)
      ).to.be.equal(newImplementation.address)
    })

    it("adds multiple implementations", async () => {
      const notOwner = (await ethers.getSigners())[1]

      // deploy different implementation at different address
      const anotherNewImplementation = await deployImplementation(notOwner)
      expect(
        newImplementation.address
      ).to.not.equal(
        anotherNewImplementation.address
      )

      // add 3rd implementation
      await creatorContract.addImplementation(newImplementation.address)
      expect(
        await creatorContract.implementations(2)
      ).to.be.equal(newImplementation.address)

      // add 4th implementation
      await creatorContract.addImplementation(anotherNewImplementation.address)
      expect(
        await creatorContract.implementations(3)
      ).to.be.equal(anotherNewImplementation.address)
    })

    it("emits ImplemnetationAdded event", async () => {
      await expect(
        creatorContract.addImplementation(newImplementation.address)
      ).to.emit(
        creatorContract,
        "ImplemnetationAdded"
      ).withArgs(
        newImplementation.address,
        2
      )
    })

  })

})