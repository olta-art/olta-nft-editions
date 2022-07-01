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
  Label,
  createApproval
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
  let admin: SignerWithAddress
  let creator: SignerWithAddress
  let ProjectCreator: ProjectCreator

  beforeEach(async () => {
    const { ProjectCreator: ProjectCreatorContract } = await deployments.fixture([
      "ProjectCreator",
    ]);

    ProjectCreator = (await ethers.getContractAt(
      "ProjectCreator",
      ProjectCreatorContract.address
    )) as ProjectCreator

    [admin, creator] = await ethers.getSigners()
  })

  describe("#createProject", () => {
    it("reverts if not an approved creator", async () => {
      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.be.revertedWith("Only approved creators can call this function.")
    })

    it("creates new edition with StandardProject implementation", async () => {
      await ProjectCreator.createProject(
        defualtProjectData,
        Implementation.standard
      )
      const editionConractAddress01 = await ProjectCreator.getProjectAtId(0, Implementation.standard)
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
      await ProjectCreator.createProject(
        defualtProjectData,
        Implementation.seeded
      )
      const editionConractAddress02 = await ProjectCreator.getProjectAtId(0, Implementation.seeded)
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
      await ProjectCreator.createProject(
        defualtProjectData,
        Implementation.standard
      )

      // create second edition
      let expectedAddress = await ProjectCreator.getProjectAtId(1, Implementation.standard)
      await expect(
        ProjectCreator.createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.emit(
        ProjectCreator,
        "CreatedProject"
      ).withArgs(
          1,                // id
          admin.address,    // creator
          10,               // edition size
          expectedAddress,
          Implementation.standard
        )

      // create first seeded edition
      expectedAddress = await ProjectCreator.getProjectAtId(0, Implementation.seeded)
      await expect(
        ProjectCreator.createProject(
          defualtProjectData,
          Implementation.seeded
        )
      ).to.emit(
        ProjectCreator,
        "CreatedProject"
      ).withArgs(
          0,              // id
          admin.address,  // creator
          10,             // edition size
          expectedAddress,
          Implementation.seeded
        )
    })
    it("reverts if implementation doesn't exist", async () => {
      await expect(
        ProjectCreator.createProject(
          defualtProjectData,
          3
        )
      ).to.be.revertedWith("implementation does not exist")
    })

    it("can be called by anyone when zero address approved", async () => {
      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.be.revertedWith("Only approved creators can call this function.")

      await ProjectCreator.setCreatorApprovals([
        createApproval(ethers.constants.AddressZero, true)
      ])

      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.emit(ProjectCreator, "CreatedProject")
    })
  })

  describe("#addImplementation", () => {
    let newImplementation: StandardProject

    const deployImplementation = async (s = admin) => {
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
        ProjectCreator.connect(notOwner).addImplementation(newImplementation.address)
      ).to.be.revertedWith("Only owner can call this function.")
    })

    it("adds an implementation", async () => {
      await ProjectCreator.addImplementation(newImplementation.address)
      expect(
        await ProjectCreator.implementations(2)
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
      await ProjectCreator.addImplementation(newImplementation.address)
      expect(
        await ProjectCreator.implementations(2)
      ).to.be.equal(newImplementation.address)

      // add 4th implementation
      await ProjectCreator.addImplementation(anotherNewImplementation.address)
      expect(
        await ProjectCreator.implementations(3)
      ).to.be.equal(anotherNewImplementation.address)
    })

    it("emits ImplemnetationAdded event", async () => {
      await expect(
        ProjectCreator.addImplementation(newImplementation.address)
      ).to.emit(
        ProjectCreator,
        "ImplemnetationAdded"
      ).withArgs(
        newImplementation.address,
        2
      )
    })

  })

  describe("#setCreatorApprovals", () => {
    it("reverts if not owner", async () => {
      await expect(
        ProjectCreator.connect(creator).setCreatorApprovals([
          createApproval(creator.address, true)
        ])
      ).to.be.revertedWith("Only owner can call this function.")
    })

    it("sets approval for creator", async () => {
      // creator can't create a project
      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.be.reverted

      // approve creator
      await ProjectCreator.setCreatorApprovals([
        createApproval(creator.address, true)
      ])

      // creator can now create projects
      expect(
        await ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.emit(ProjectCreator, "CreatedProject")
    })

    it("sets approval for creators", async () => {
      // creator can't create a project
      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.be.reverted

      // approve creator
      await ProjectCreator.setCreatorApprovals([
        createApproval(creator.address, true),
        createApproval(admin.address, false),
      ])

      // creator can now create projects
      await expect(
        ProjectCreator.connect(creator).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.emit(ProjectCreator, "CreatedProject")

      // signer can now create projects
      await expect(
       ProjectCreator.connect(admin).createProject(
          defualtProjectData,
          Implementation.standard
        )
      ).to.be.reverted
    })
    it("emits a list of creator approval updates", async () => {

      const tx = await ProjectCreator.setCreatorApprovals([
        createApproval(creator.address, true),
        createApproval(admin.address, true),
      ])

      const recpient = await tx.wait()
      const events = recpient.events?.filter((x) => x.event == "CreatorApprovalsUpdated")
      const eventArgs = events?.[0].args

      expect(eventArgs).to.deep.equal([
        [
          [
            creator.address,
            true
          ],
          [
            admin.address,
            true
          ]
        ]
      ])
    })
  })

})