// Note[George]: Quickly copied over relevant tests to check feature change
// to only run this test use `yarn hardhat test ./test/mint-with-seed.ts`

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

const fetchMetadata = async (tokenId: number, contract: SingleEditionMintable) => {
  const tokenURI = await contract.tokenURI(tokenId);
  const parsedTokenURI = parseDataURI(tokenURI);
  if (!parsedTokenURI) {
    throw "No parsed token uri";
  }

  // parse metadata body
  const uriData = Buffer.from(parsedTokenURI.body).toString("utf-8");
  return JSON.parse(uriData);
}

describe.only("mint with seed feature", () => {
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
      await expect(minterContract["mintEdition(address)"](signerAddress))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );
    });

    it("creates new edition with seed", async () => {
      const seed = 5
      await expect(minterContract["mintEdition(address,uint256)"](signerAddress, seed)
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );
    });

    it("auto assigns next available seed", async () => {
      // TODO: read metadata and check seed number
      const seed = 2

      // with seed 2
      await expect(minterContract["mintEdition(address,uint256)"](signerAddress, seed)
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );

      const metadata1 = await fetchMetadata(1, minterContract)

      expect(
        metadata1.animation_url
      ).to.equal(
        "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=1"
        + `&address=${minterContract.address.toLowerCase()}`
        + `&seed=2`
      );

      // without seed - seed = 1
      await expect(minterContract["mintEdition(address)"](signerAddress)
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          2
        );

      const metadata2 = await fetchMetadata(2, minterContract)

      expect(
        metadata2.animation_url
      ).to.equal(
        "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=2"
        + `&address=${minterContract.address.toLowerCase()}`
        + `&seed=1`
      );

      // without seed - seed = 3
      // seed should skip 2 becuase already used
      await expect(minterContract["mintEdition(address)"](signerAddress)
      ).to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          3
         );

      const metadata3 = await fetchMetadata(3, minterContract)

      expect(
        metadata3.animation_url
      ).to.equal(
        "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=3"
        + `&address=${minterContract.address.toLowerCase()}`
        + `&seed=3`
      );
    });

    it("reverts if seed already used", async () => {
      // Mint first edition - seed = 1
      await expect(minterContract["mintEdition(address)"](signerAddress))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );

      await expect(minterContract["mintEdition(address,uint256)"](signerAddress, 1)
      ).to.be.revertedWith("Seed already used")
    });

    it("reverts if seed out of range", async () => {
      await expect(
         minterContract["mintEdition(address,uint256)"](signerAddress, 0)
      ).to.be.revertedWith("Seed out of range")

      await expect(
         minterContract["mintEdition(address,uint256)"](signerAddress, 11)
      ).to.be.revertedWith("Seed out of range")
    });

    it("creates a set of editions with specific seeds", async () => {
      const [s1, s2, s3] = await ethers.getSigners();
      await minterContract["mintEditions(address[],uint256[])"](
        [
        await s1.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
        ],
        // specific seed array
        [10, 5, 1]
      );
      expect(await minterContract.ownerOf(1)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(2)).to.equal(await s2.getAddress());
      expect(await minterContract.ownerOf(3)).to.equal(await s3.getAddress());

      await minterContract["mintEditions(address[],uint256[])"]([
        await s1.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
      ],
      [2,4,3,9,8,7,6]);

      await expect(minterContract["mintEditions(address[],uint256[])"]([signerAddress],[11])).to.be.reverted;
    });
  });
});