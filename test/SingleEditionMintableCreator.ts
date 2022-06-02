import { expect } from "chai";
// import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import parseDataURI from "data-urls";

import {
  SingleEditionMintableCreator,
  SingleEditionMintable,
  SeededSingleEditionMintable
} from "../typechain";

import {
  editionData,
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

const defualtEditionData = editionData(
  "Testing Token",
  "TEST",
  "This is a testing token for all",
  defaultVersion(),
  10,
  10
)

describe.only("SingleEditionMintable", () => {
  let signer: SignerWithAddress;
  let signerAddress: string;
  let creatorContract: SingleEditionMintableCreator;

  beforeEach(async () => {
    const { SingleEditionMintableCreator } = await deployments.fixture([
      "SingleEditionMintableCreator",
      "SingleEditionMintable",
    ]);

    creatorContract = (await ethers.getContractAt(
      "SingleEditionMintableCreator",
      SingleEditionMintableCreator.address
    )) as SingleEditionMintableCreator

    signer = (await ethers.getSigners())[0]
    signerAddress = await signer.getAddress()
  })

  describe("#createEdition", () => {
    it("creates new edition with singleEditionMintable implementation", async () => {
      await creatorContract.createEdition(
        defualtEditionData,
        Implementation.editions
      )
      const editionConractAddress01 = await creatorContract.getEditionAtId(1, Implementation.editions)
      const editionsContract01 = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionConractAddress01
      )) as SingleEditionMintable;

      // check supports SingleEditionMintable interface
      expect(
        await editionsContract01.supportsInterface("0x2fc51e5a")
      ).to.be.true
    })

    it("creates new edition with seededSingleEditionMintable implementation", async () => {
      await creatorContract.createEdition(
        defualtEditionData,
        Implementation.seededEditions
      )
      const editionConractAddress02 = await creatorContract.getEditionAtId(1, Implementation.seededEditions)
      const editionsContract02 = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionConractAddress02
      )) as SeededSingleEditionMintable;

      // check supports SeededSingleEditionMintable interface
      expect(
        await editionsContract02.supportsInterface("0x26057e5e")
      ).to.be.true
    })

    it("should increment a seperate id counter for each implementation", async () => {

       // create first edition
      await creatorContract.createEdition(
        defualtEditionData,
        Implementation.editions
      )

      // create second edition
      let expectedAddress = await creatorContract.getEditionAtId(2, Implementation.editions)
      await expect(
        creatorContract.createEdition(
          defualtEditionData,
          Implementation.editions
        )
      ).to.emit(
        creatorContract,
        "CreatedEdition"
      ).withArgs(
          2,                // id
          signerAddress,    // creator
          10,               // edition size
          expectedAddress,
          Implementation.editions
        )

      // create first seeded edition
      expectedAddress = await creatorContract.getEditionAtId(1, Implementation.seededEditions)
      await expect(
        creatorContract.createEdition(
          defualtEditionData,
          Implementation.seededEditions
        )
      ).to.emit(
        creatorContract,
        "CreatedEdition"
      ).withArgs(
          1,              // id
          signerAddress,  // creator
          10,             // edition size
          expectedAddress,
          Implementation.seededEditions
        )
    })
    it("reverts if implementation doesn't exist", async () => {
      await expect(
        creatorContract.createEdition(
          defualtEditionData,
          3
        )
      ).to.be.revertedWith("implementation does not exist")
    })
  })

  // TODO: add implementation

})