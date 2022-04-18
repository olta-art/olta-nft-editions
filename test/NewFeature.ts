// Note[George]: Quickly copied over relevant tests to check feature change
// to only run this test use `yarn hardhat test ./test/NewFeature.ts`

import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers, deployments } from "hardhat";
import parseDataURI from "data-urls";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  SingleEditionMintableCreator,
  SingleEditionMintable,
} from "../typechain";
import { BigNumberish } from "ethers";

type Label = [BigNumberish, BigNumberish, BigNumberish]

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

const toMintData = (to: string, id: BigNumberish) => ({to, id})

describe.only("mint any id feature", () => {
  let signer: SignerWithAddress;
  let signerAddress: string;
  let dynamicSketch: SingleEditionMintableCreator;

  beforeEach(async () => {
    const { SingleEditionMintableCreator } = await deployments.fixture([
      "SingleEditionMintableCreator",
      "SingleEditionMintable",
    ]);
    const dynamicMintableAddress = (
      await deployments.get("SingleEditionMintable")
    ).address;
    dynamicSketch = (await ethers.getContractAt(
      "SingleEditionMintableCreator",
      SingleEditionMintableCreator.address
    )) as SingleEditionMintableCreator;

    signer = (await ethers.getSigners())[0];
    signerAddress = await signer.getAddress();
  });

  describe("with a edition", () => {
    let signer1: SignerWithAddress;
    let minterContract: SingleEditionMintable;
    beforeEach(async () => {
      signer1 = (await ethers.getSigners())[1];
      await dynamicSketch.createEdition(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
        // 1% royalty since BPS
        10,
        10
      );

      const editionResult = await dynamicSketch.getEditionAtId(0);
      minterContract = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionResult
      )) as SingleEditionMintable;
    });

    it("creates a new edition", async () => {
      // Mint first edition
      await expect(minterContract.mintEdition({to: signerAddress, id: 1}))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );
    });

    it("creates new edition with specific id", async () => {
      await expect(minterContract.mintEdition(
        {
          to: signerAddress,
          id: 5
        })
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          5
        );
    });

    it("creates new edition with specific id", async () => {
      await expect(minterContract.mintEdition(
        {
          to: signerAddress,
          id: 5
        })
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          5
        );

      expect(await minterContract.ownerOf(5)).to.equal(
        signerAddress
      );
    });

    it("creates a set of editions (orderd)", async () => {
      const [s1, s2, s3] = await ethers.getSigners();
      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 1),
        toMintData(await s2.getAddress(), 2),
        toMintData(await s3.getAddress(), 3)
      ]);
      expect(await minterContract.ownerOf(1)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(2)).to.equal(await s2.getAddress());
      expect(await minterContract.ownerOf(3)).to.equal(await s3.getAddress());

      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 4),
        toMintData(await s2.getAddress(), 5),
        toMintData(await s3.getAddress(), 6),
        toMintData(await s2.getAddress(), 7),
        toMintData(await s3.getAddress(), 8),
        toMintData(await s2.getAddress(), 9),
        toMintData(await s3.getAddress(), 10),
      ]);
      await expect(minterContract.mintEditions([toMintData(signerAddress, 11)])).to.be.reverted;
    });

    // failing
    it("creates a set of editions (un-ordered)", async () => {
      const [s1, s2, s3] = await ethers.getSigners();
      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 10),
        toMintData(await s2.getAddress(), 5),
        toMintData(await s3.getAddress(), 1)
      ]);
      expect(await minterContract.ownerOf(10)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(5)).to.equal(await s2.getAddress());
      expect(await minterContract.ownerOf(1)).to.equal(await s3.getAddress());

      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 2),
        toMintData(await s2.getAddress(), 4),
        toMintData(await s3.getAddress(), 3),
        toMintData(await s2.getAddress(), 9),
        toMintData(await s3.getAddress(), 8),
        toMintData(await s2.getAddress(), 7),
        toMintData(await s3.getAddress(), 6),
      ]);
      await expect(minterContract.mintEditions([toMintData(signerAddress, 11)])).to.be.reverted;
    });

    it("reverts if edition id already minted (ordered)", async () => {
      const [s1, s2] = await ethers.getSigners();
      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 1),
        toMintData(await s2.getAddress(), 2),
      ]);
      expect(await minterContract.ownerOf(1)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(2)).to.equal(await s2.getAddress());

      await expect(
        minterContract.mintEditions([
          toMintData(await s1.getAddress(), 1),
          toMintData(await s2.getAddress(), 2),
        ])
      ).to.be.revertedWith("ERC721: token already minted")
    })

    it("reverts if edition id already minted (un-orderd)", async () => {
      const [s1, s2] = await ethers.getSigners();
      await minterContract.mintEditions([
        toMintData(await s1.getAddress(), 5),
        toMintData(await s2.getAddress(), 10),
      ]);
      expect(await minterContract.ownerOf(5)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(10)).to.equal(await s2.getAddress());

      await expect(
        minterContract.mintEditions([
          toMintData(await s1.getAddress(), 5),
          toMintData(await s2.getAddress(), 10),
        ])
      ).to.be.revertedWith("ERC721: token already minted")
    })

    // failing
    it("reverts if edition id out of range", async () => {
      expect(
        await minterContract.mintEdition(
          toMintData(signerAddress, 0)
        )
      ).to.be.revertedWith("edition id out of range")

      expect(
        await minterContract.mintEdition(
          toMintData(signerAddress, 11)
        )
      ).to.be.revertedWith("edition id out of range")
    });

  });
});