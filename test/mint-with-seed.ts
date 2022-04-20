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
    ],
    label: [0,0,1] as Label
  }
}

// Helpers

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

const getAnimationUrl = async (contract: SingleEditionMintable, id: number) => {
  const metadata = await fetchMetadata(id, contract)
  return metadata.animation_url
}

const expectedUrl = (contract: SingleEditionMintable, id: number, seed: number) => {
  return defaultAnimationURl
    + "?"
    + `id=${id}`
    + `&address=${contract.address.toLowerCase()}`
    + `&seed=${seed}`
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

  describe("# mintEdition", () => {
    let minterContract: SingleEditionMintable;

    beforeEach(async () => {
      await dynamicSketch.createEdition(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
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
      await expect(
        minterContract["mintEdition(address)"](signerAddress)
      ).to.emit(minterContract, "Transfer")
    });

    it("creates new edition with seed", async () => {
      const seed = 1
      await expect(
        minterContract["mintEdition(address,uint256)"](signerAddress, seed)
      ).to.emit(minterContract, "Transfer")
    });

    it("auto assigns next available seed", async () => {

      const seed = 2
      await expect(
        minterContract["mintEdition(address,uint256)"](signerAddress, seed)
      ).to.emit(minterContract, "Transfer")

      expect(
        await getAnimationUrl(minterContract, 1)
      ).to.equal(
        expectedUrl(minterContract, 1, seed)
      );

      // should auto assign seed 1
      await expect(minterContract["mintEdition(address)"](signerAddress)
      ).to.emit(minterContract, "Transfer")

      expect(
        await getAnimationUrl(minterContract, 2)
      ).to.equal(
        expectedUrl(minterContract, 2, 1)
      );

      // should skip seed 2 and auto assign seed 3
      await expect(minterContract["mintEdition(address)"](signerAddress)
      ).to.emit(minterContract, "Transfer")

      expect(
        await getAnimationUrl(minterContract, 3)
      ).to.equal(
        expectedUrl(minterContract, 3, 3)
      )
    });

    it("reverts if seed already used", async () => {
      const seed = 1
      await expect(
        minterContract["mintEdition(address,uint256)"](signerAddress, seed)
      ).to.emit(minterContract, "Transfer")

      await expect(
        minterContract["mintEdition(address,uint256)"](signerAddress, seed)
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

  });

  describe("# mintEditions", () => {

    let minterContract: SingleEditionMintable;

    beforeEach(async () => {
      await dynamicSketch.createEdition(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
        10,
        10
      );

      const editionResult = await dynamicSketch.getEditionAtId(0);
      minterContract = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionResult
      )) as SingleEditionMintable;
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

  describe("# purchase", () => {
    let minterContract: SingleEditionMintable;
    let oneEth = ethers.utils.parseEther("1")

    beforeEach(async () => {
      await dynamicSketch.createEdition(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
        10,
        10
      );

      const editionResult = await dynamicSketch.getEditionAtId(0);
      minterContract = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionResult
      )) as SingleEditionMintable;

      // set sale price to 1 ETH
      await minterContract.setSalePrice(oneEth)
    });

    it("purchases new edition", async () => {
      await expect(
         minterContract["purchase()"]({value: oneEth})
      ).to.emit(minterContract, "EditionSold")
    });

    it("purchases new edition with seed", async () => {
      const seed = 2
      await expect(
        minterContract["purchase(uint256)"](seed, {value: oneEth})
     ).to.emit(minterContract, "EditionSold")
    });
  })

  describe("gas optimisation", () => {
    let signer: SignerWithAddress;
    let signerAddress: string;
    let minterContract: SingleEditionMintable;

    beforeEach(async () => {
      signer = (await ethers.getSigners())[1];
      signerAddress = await signer.getAddress()
      await dynamicSketch.createEdition(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
        1000, // large number of editions
        10
      );

      const editionResult = await dynamicSketch.getEditionAtId(0);
      minterContract = (await ethers.getContractAt(
        "SingleEditionMintable",
        editionResult
      )) as SingleEditionMintable
    })

    it("auto allocates next seed and with cache", async () => {
      // create large group of used seeds between 2 and 99
      const generatedAddresses: string[] = []
      const generatedSeeds: number[] = []
      for (let i = 2; i < 100; i++) {
        generatedAddresses.push(signerAddress)
        generatedSeeds.push(i)
      }
      // mint generated seeds
      await minterContract["mintEditions(address[],uint256[])"](
        generatedAddresses,
        generatedSeeds
      )

      const mintEdition = async () => {
        const tx =  await minterContract["mintEdition(address)"](signerAddress)
        return await tx.wait()
      }

      // recorded gas usage 131738
      const seed1_GasPrice = (await mintEdition()).gasUsed
      expect(
        await getAnimationUrl(minterContract, 99)
      ).to.equal(
        expectedUrl(minterContract, 99, 1)
      );

      // recorded gas usage 353278
      const seed100_GasPrice = (await mintEdition()).gasUsed
      expect(
        await getAnimationUrl(minterContract, 100)
      ).to.equal(
        expectedUrl(minterContract, 100, 100)
      );

      // recorded gas usage 117490
      const seed101_GasPrice =  (await mintEdition()).gasUsed
      expect(
        await getAnimationUrl(minterContract, 101)
      ).to.equal(
        expectedUrl(minterContract, 101, 101)
      );

      console.log(`
        gas:
        intial purchase: ${seed1_GasPrice.toString()}
        gap purchase: ${seed100_GasPrice.toString()}
        after gap purchase: ${seed101_GasPrice.toString()}
      `)

      // should be higher becuase of for loop to find next available seed
      expect(seed100_GasPrice.gt(seed1_GasPrice))

      // should be less than becuase of cached last used seed
      expect(seed101_GasPrice.lt(seed100_GasPrice))
    })
  })
});