// Note[George]: Quickly copied over relevant tests to check feature change
// to only run this test use `yarn hardhat test ./test/mint-with-seed.ts`

import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import parseDataURI from "data-urls";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ProjectCreator,
  SeededProject,
} from "../typechain";

import {
  projectData,
  Implementation,
  Label
} from "./utils"

const defaultAnimationURl = "https://arweave.net/<tx-hash-length-000000000000000000000>"

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
        url: defaultAnimationURl,
        sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
      // patch notes
      {
        url: "",
        sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
    ],
    label: [0,0,1] as Label
  }
}

// Helpers

const fetchMetadata = async (tokenId: number, contract: SeededProject) => {
  const tokenURI = await contract.tokenURI(tokenId);
  const parsedTokenURI = parseDataURI(tokenURI);
  if (!parsedTokenURI) {
    throw "No parsed token uri";
  }

  // parse metadata body
  const uriData = Buffer.from(parsedTokenURI.body).toString("utf-8");
  return JSON.parse(uriData);
}

const getAnimationUrl = async (contract: SeededProject, id: number) => {
  const metadata = await fetchMetadata(id, contract)
  return metadata.animation_url
}

const expectedUrl = (contract: SeededProject, id: number, seed: number) => {
  return defaultAnimationURl
    + "?"
    + `id=${id}`
    + `&address=${contract.address.toLowerCase()}`
    + `&seed=${seed}`
}

const createMintData = (to: string, seed: number) => ({to, seed})

describe("SeededProject", () => {
  let signer: SignerWithAddress;
  let signerAddress: string;
  let dynamicSketch: ProjectCreator;

  beforeEach(async () => {
    const { ProjectCreator } = await deployments.fixture([
      "ProjectCreator",
    ]);
    const dynamicMintableAddress = (
      await deployments.get("SeededProject")
    ).address;
    dynamicSketch = (await ethers.getContractAt(
      "ProjectCreator",
      ProjectCreator.address
    )) as ProjectCreator;

    signer = (await ethers.getSigners())[0];
    signerAddress = await signer.getAddress();
  });

  describe("#mintEdition", () => {
    let minterContract: SeededProject;

    beforeEach(async () => {
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          10,
          10
        ),
        Implementation.seeded
      );

      const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.seeded);
      minterContract = (await ethers.getContractAt(
        "SeededProject",
        editionResult
      )) as SeededProject;
    });

    it("creates new edition with seed", async () => {
      const seed = 1
      await expect(
        minterContract.mintEdition(signerAddress, seed)
      ).to.emit(minterContract, "Transfer")
    });

    it("reverts if seed already used", async () => {
      const seed = 1
      await expect(
        minterContract.mintEdition(signerAddress, seed)
      ).to.emit(minterContract, "Transfer")

      await expect(
        minterContract.mintEdition(signerAddress, seed)
      ).to.be.revertedWith("Seed already used")
    });

    it("reverts if seed out of range", async () => {
      await expect(
         minterContract.mintEdition(signerAddress, 0)
      ).to.be.revertedWith("Seed out of range")

      await expect(
         minterContract.mintEdition(signerAddress, 11)
      ).to.be.revertedWith("Seed out of range")
    });

  });

  describe("#mintEditions", () => {

    let minterContract: SeededProject;

    beforeEach(async () => {
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          10,
          10
        ),
        Implementation.seeded
      );

      const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.seeded);
      minterContract = (await ethers.getContractAt(
        "SeededProject",
        editionResult
      )) as SeededProject;
    });


    it("creates a set of editions with specific seeds", async () => {
      const [s1, s2, s3] = await ethers.getSigners();

      await minterContract.mintEditions(
        [
          createMintData(await s1.getAddress(), 10),
          createMintData(await s2.getAddress(), 5),
          createMintData(await s3.getAddress(), 1),
        ],
      );
      expect(await minterContract.ownerOf(1)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(2)).to.equal(await s2.getAddress());
      expect(await minterContract.ownerOf(3)).to.equal(await s3.getAddress());

      await minterContract.mintEditions(
        [
          createMintData(await s1.getAddress(), 2),
          createMintData(await s2.getAddress(), 4),
          createMintData(await s3.getAddress(), 3),
          createMintData(await s2.getAddress(), 9),
          createMintData(await s3.getAddress(), 8),
          createMintData(await s2.getAddress(), 7),
          createMintData(await s3.getAddress(), 6),
        ]
      );

      await expect(
        minterContract.mintEditions([createMintData(signerAddress, 11)])
      ).to.be.reverted;
    });
  });

  describe("#purchase", () => {
    let minterContract: SeededProject
    let oneEth = ethers.utils.parseEther("1")

    beforeEach(async () => {
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          10,
          10
        ),
        Implementation.seeded
      );

      const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.seeded);
      minterContract = (await ethers.getContractAt(
        "SeededProject",
        editionResult
      )) as SeededProject;

      // set sale price to 1 ETH
      await minterContract.setSalePrice(oneEth)
    });

    it("purchases new edition with seed", async () => {
      const seed = 2
      await expect(
        minterContract.purchase(seed, {value: oneEth})
     ).to.emit(minterContract, "EditionSold")
    });
  })

  describe('#setRoyaltyRecipient', () => {
    let minterContract: SeededProject
    beforeEach(async () => {
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          10,
          1000 // 10%
        ),
        Implementation.seeded
      );

      const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.seeded);
      minterContract = (await ethers.getContractAt(
        "SeededProject",
        editionResult
      )) as SeededProject;
    });
    it("should set new royalty recipient", async () => {
      const walletOrContract = (await ethers.getSigners())[3]
      const walletOrContractAddress = await walletOrContract.getAddress()

      expect(
        await minterContract.setRoyaltyFundsRecipient(walletOrContractAddress)
      ).to.emit(
        minterContract, "RoyaltyFundsRecipientChanged"
      ).withArgs(
        walletOrContractAddress
      )

      // display correct royalty info
      expect(
        await minterContract.royaltyInfo(100, ethers.utils.parseEther("1.0"))
      ).to.deep.equal(
        [
          walletOrContractAddress,
          ethers.utils.parseEther("0.1")
        ]
      )
    })
  })
});