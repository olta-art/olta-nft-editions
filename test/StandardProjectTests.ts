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
      // patch notes
      {
        url: "",
        sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
    ],
    label: [0,0,1] as Label
  }
}

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

  it("makes a new edition", async () => {
    await dynamicSketch.createProject(
      projectData(
        "Testing Token",
        "TEST",
        "This is a testing token for all",
        defaultVersion(),
        // 1% royalty since BPS
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
    const editionUris = await minterContract.getURIs();
    expect(editionUris[0]).to.be.equal("");
    expect(editionUris[1]).to.be.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(editionUris[2]).to.be.equal(
      "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy"
    );
    expect(editionUris[3]).to.be.equal(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(await minterContract.editionSize()).to.be.equal(10);
    // TODO(iain): check bps
    expect(await minterContract.owner()).to.be.equal(signerAddress);
  });
  describe("with a edition", () => {
    let signer1: SignerWithAddress;
    let minterContract: StandardProject;
    beforeEach(async () => {
      signer1 = (await ethers.getSigners())[1];
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          // 1% royalty since BPS
          10,
          10
        ),
        Implementation.standard
      );

      const editionResult = await dynamicSketch.getProjectAtId(0, Implementation.standard);
      minterContract = (await ethers.getContractAt(
        "StandardProject",
        editionResult
      )) as StandardProject;
    });
    it("creates a new edition", async () => {
      expect(await signer1.getBalance()).to.eq(
        ethers.utils.parseEther("10000")
      );

      // Mint first edition
      await expect(minterContract.mintEdition(signerAddress))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );

      const tokenURI = await minterContract.tokenURI(1);
      const parsedTokenURI = parseDataURI(tokenURI);
      if (!parsedTokenURI) {
        throw "No parsed token uri";
      }

      // Check metadata from edition
      const uriData = Buffer.from(parsedTokenURI.body).toString("utf-8");
      const metadata = JSON.parse(uriData);

      expect(parsedTokenURI.mimeType.type).to.equal("application");
      expect(parsedTokenURI.mimeType.subtype).to.equal("json");
      // expect(parsedTokenURI.mimeType.parameters.get("charset")).to.equal(
      //   "utf-8"
      // );
      expect(JSON.stringify(metadata)).to.equal(
        JSON.stringify({
          name: "Testing Token 1/10",
          description: "This is a testing token for all",
          animation_url:
            "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=1"
            + `&address=${minterContract.address.toLowerCase()}`,
          media_version: "0.0.1",
          patch_notes: "",
          properties: { number: 1, name: "Testing Token" },
        })
      );
    });
    it("creates an unbounded edition", async () => {
      // no limit for edition size
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          // 1% royalty since BPS
          0,
          0
        ),
        Implementation.standard
      );

      const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
      minterContract = (await ethers.getContractAt(
        "StandardProject",
        editionResult
      )) as StandardProject;

      expect(await minterContract.totalSupply()).to.be.equal(0);

      // Mint first edition
      await expect(minterContract.mintEdition(signerAddress))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          1
        );

      expect(await minterContract.totalSupply()).to.be.equal(1);

      // Mint second edition
      await expect(minterContract.mintEdition(signerAddress))
        .to.emit(minterContract, "Transfer")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          signerAddress,
          2
        );

      expect(await minterContract.totalSupply()).to.be.equal(2);

      const tokenURI = await minterContract.tokenURI(1);
      const parsedTokenURI = parseDataURI(tokenURI);
      if (!parsedTokenURI) {
        throw "No parsed token uri";
      }

      const tokenURI2 = await minterContract.tokenURI(2);
      const parsedTokenURI2 = parseDataURI(tokenURI2);

      // Check metadata from edition
      const uriData = Buffer.from(parsedTokenURI.body).toString("utf-8");
      const metadata = JSON.parse(uriData);

      const uriData2 = Buffer.from(parsedTokenURI2?.body || "").toString(
        "utf-8"
      );
      const metadata2 = JSON.parse(uriData2);
      expect(metadata2.name).to.be.equal("Testing Token 2");

      expect(parsedTokenURI.mimeType.type).to.equal("application");
      expect(parsedTokenURI.mimeType.subtype).to.equal("json");
      expect(JSON.stringify(metadata)).to.equal(
        JSON.stringify({
          name: "Testing Token 1",
          description: "This is a testing token for all",
          animation_url:
            "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=1"
            + `&address=${minterContract.address.toLowerCase()}`,
          media_version: "0.0.1",
          patch_notes: "",
          properties: { number: 1, name: "Testing Token" },
        })
      );
    });
    it("creates an authenticated edition", async () => {
      await minterContract.mintEdition(await signer1.getAddress());
      expect(await minterContract.ownerOf(1)).to.equal(
        await signer1.getAddress()
      );
    });
    it("allows user burn", async () => {
      await minterContract.mintEdition(await signer1.getAddress());
      expect(await minterContract.ownerOf(1)).to.equal(
        await signer1.getAddress()
      );
      await minterContract.connect(signer1).burn(1);
      await expect(minterContract.ownerOf(1)).to.be.reverted;
    });
    it("does not allow re-initialization", async () => {
      await expect(
        minterContract.initialize(
          signerAddress,
          "test name",
          "SYM",
          "description",
          {
            urls: [
              {
                url: "image",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
              },
              {
                url: "animation",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
              }
            ],
            label: [0,0,1]
          },
          12,
          12
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
      await minterContract.mintEdition(await signer1.getAddress());
      expect(await minterContract.ownerOf(1)).to.equal(
        await signer1.getAddress()
      );
    });
    it("creates a set of editions", async () => {
      const [s1, s2, s3] = await ethers.getSigners();
      await minterContract.mintEditions([
        await s1.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
      ]);
      expect(await minterContract.ownerOf(1)).to.equal(await s1.getAddress());
      expect(await minterContract.ownerOf(2)).to.equal(await s2.getAddress());
      expect(await minterContract.ownerOf(3)).to.equal(await s3.getAddress());
      await minterContract.mintEditions([
        await s1.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
      ]);
      await expect(minterContract.mintEditions([signerAddress])).to.be.reverted;
      await expect(minterContract.mintEdition(signerAddress)).to.be.reverted;
    });
    it("returns interfaces correctly", async () => {
      // ERC2891 interface
      expect(await minterContract.supportsInterface("0x2a55205a")).to.be.true;
      // ERC165 interface
      expect(await minterContract.supportsInterface("0x01ffc9a7")).to.be.true;
      // ERC721 interface
      expect(await minterContract.supportsInterface("0x80ac58cd")).to.be.true;
    });
    describe("royalty 2981", () => {
      it("follows royalty payout for owner recpient", async () => {
        await minterContract.mintEdition(signerAddress);
        // allows royalty payout info to be updated
        expect((await minterContract.royaltyInfo(1, 100))[0]).to.be.equal(
          signerAddress
        );
        await minterContract.transferOwnership(await signer1.getAddress());
        expect((await minterContract.royaltyInfo(1, 100))[0]).to.be.equal(
          signerAddress // original owner
        );
      });
      it("sets the correct royalty amount", async () => {
        await dynamicSketch.createProject(
          projectData(
            "Testing Token",
            "TEST",
            "This is a testing token for all",
            defaultVersion(),
            // 2% royalty since BPS
            200,
            200
          ),
          Implementation.standard
        );

        const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
        const minterContractNew = (await ethers.getContractAt(
          "StandardProject",
          editionResult
        )) as StandardProject;

        await minterContractNew.mintEdition(signerAddress);
        expect((await minterContractNew.royaltyInfo(1, ethers.utils.parseEther("1.0")))[1]).to.be.equal(
          ethers.utils.parseEther("0.02")
        );
      });
    });

    describe('#setRoyaltyRecipient', () => {
      let minterContract: StandardProject
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
          Implementation.standard
        );

        const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
        minterContract = (await ethers.getContractAt(
          "StandardProject",
          editionResult
        )) as StandardProject;
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
    it("mints a large batch", async () => {
      // no limit for edition size
      await dynamicSketch.createProject(
        projectData(
          "Testing Token",
          "TEST",
          "This is a testing token for all",
          defaultVersion(),
          // 1% royalty since BPS
          0,
          0
        ),
        Implementation.standard
      );

      const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
      minterContract = (await ethers.getContractAt(
        "StandardProject",
        editionResult
      )) as StandardProject;

      const [s1, s2, s3] = await ethers.getSigners();
      const [s1a, s2a, s3a] = [
        await s1.getAddress(),
        await s2.getAddress(),
        await s3.getAddress(),
      ];
      const toAddresses = [];
      for (let i = 0; i < 100; i++) {
        toAddresses.push(s1a);
        toAddresses.push(s2a);
        toAddresses.push(s3a);
      }
      await minterContract.mintEditions(toAddresses);
    });
    it("stops after editions are sold out", async () => {
      const [_, signer1] = await ethers.getSigners();

      expect(await minterContract.numberCanMint()).to.be.equal(10);

      // Mint first edition
      for (var i = 1; i <= 10; i++) {
        await expect(minterContract.mintEdition(await signer1.getAddress()))
          .to.emit(minterContract, "Transfer")
          .withArgs(
            "0x0000000000000000000000000000000000000000",
            await signer1.getAddress(),
            i
          );
      }

      expect(await minterContract.numberCanMint()).to.be.equal(0);

      await expect(
        minterContract.mintEdition(signerAddress)
      ).to.be.revertedWith("Sold out");

      const tokenURI = await minterContract.tokenURI(10);
      const parsedTokenURI = parseDataURI(tokenURI);
      if (!parsedTokenURI) {
        throw "No parsed token uri";
      }

      // Check metadata from edition
      const uriData = Buffer.from(parsedTokenURI.body).toString("utf-8");
      const metadata = JSON.parse(uriData);

      expect(parsedTokenURI.mimeType.type).to.equal("application");
      expect(parsedTokenURI.mimeType.subtype).to.equal("json");
      expect(JSON.stringify(metadata)).to.equal(
        JSON.stringify({
          name: "Testing Token 10/10",
          description: "This is a testing token for all",
          animation_url:
            "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy?id=10"
            + `&address=${minterContract.address.toLowerCase()}`,
          media_version: "0.0.1",
          patch_notes: "",
          properties: { number: 10, name: "Testing Token" },
        })
      );
    });
    describe("versions", () => {
      beforeEach(async()  => {

        // Mint first edition
        await expect(minterContract.mintEdition(signerAddress))
          .to.emit(minterContract, "Transfer")
          .withArgs(
            "0x0000000000000000000000000000000000000000",
            signerAddress,
            1
          );

      })
      describe("#addVersion()", () => {
        const createMockVersion = (label: Label) => {
          return {
            urls: [
              {
                url: "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
              },
              {
                url: "",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
              },
              {
                url: "",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
              }
            ],
            label
          }
        }
        it("reverts if not creator", async () => {
          const [_, other] = await ethers.getSigners()
          await expect (
            minterContract
            .connect(other)
            .addVersion(createMockVersion([1,0,0]))
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })
        it("throws if version label too big", async () => {
          try{
            await minterContract.addVersion(
              createMockVersion([0,0,256])
            )
          }
          catch(error: any){
              expect(error.code).to.eq("INVALID_ARGUMENT")
          }
        })
        it("adds version", async () => {
          await expect (
            minterContract.addVersion(
              {
                urls: [
                  {
                    url: "imageUrl",
                    sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
                  },
                  {
                    url: "animationUrl",
                    sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001",
                  },
                  {
                    url: "patchNotesUrl",
                    sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
                  }
                ],
                label: [0,0,2]
              },
            )
          ).to.emit(minterContract, "VersionAdded")
              .withArgs([0,0,2])

          expect(await minterContract.getURIs()).to.deep.eq(
            [
              'imageUrl',
              '0x0000000000000000000000000000000000000000000000000000000000000001',
              'animationUrl',
              '0x0000000000000000000000000000000000000000000000000000000000000001',
              'patchNotesUrl',
              '0x0000000000000000000000000000000000000000000000000000000000000001'
            ]
          )
        });
        it("always adds a version with three urls and hashes", async () => {
          minterContract.addVersion(
            {
              urls: [
                {
                  url: "only one url",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
                }
              ],
              label: [0,0,2]
            },
          )
          expect(await minterContract.getURIs()).to.deep.eq(
            [
              'only one url',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '',
              '0x0000000000000000000000000000000000000000000000000000000000000000'
            ]
          )
        })
        it("adds large number of versions", async () => {
          const versions: Label[] = []
          // populate versions // 10 * 5 * 2 = 100
          for (let major = 0; major < 2; major++) {
            for (let minor = 0; minor < 5; minor++) {
              for (let patch = 0; patch < 10; patch++) {
                const version = [major, minor, patch] as Label
                versions.push(version)
              }
            }
          }

          // adds 99 versions
          for (let i = 2; i < versions.length; i++) {
            // skip already added
            if(i == 1) continue

            await expect(
              minterContract.addVersion(
                createMockVersion(versions[i])
              )
            ).to.emit(minterContract, "VersionAdded")
          }
        });
      });

      describe("#finalizeEditionSize", () => {
        it("should revert if not the creator", async () => {
          await expect(
            minterContract.connect(signer1).finalizeEditionSize()
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })
        it("should revert if not open edition", async () => {
          await expect(
            minterContract.finalizeEditionSize()
          ).to.be.revertedWith("Must be open edition")
        })
        it("should finalize the edition size", async () => {
          // create an open edition contract
          await dynamicSketch.createProject(
            projectData(
              "Testing Token",
              "TEST",
              "This is a testing token for all",
              defaultVersion(),
              0, // open edition
              0
            ),
            Implementation.standard
          );
          const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
          const openEditionContract = (await ethers.getContractAt(
            "StandardProject",
            editionResult
          )) as StandardProject;

          // mint an nft
          await openEditionContract.mintEdition(signerAddress)

          // finalize edition size
          await expect(
            openEditionContract.finalizeEditionSize()
          ).to.emit(
            openEditionContract, "EditionSizeFinalized"
          ).withArgs(
            1
          )

          // try to mint another nft
          await expect(
            openEditionContract.mintEdition(signerAddress)
          ).to.be.revertedWith("Sold out")
        })
      })

      describe("#updateVersionURL()", () => {
        it("reverts if not creator", async () => {
          const [_, other] = await ethers.getSigners()
          await expect (
            minterContract
              .connect(other)
              .updateVersionURL(
                [0,0,2],
                1,
                "updatedImageURL"
              )
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("reverts when version doesn't exist", async () => {
          // Update image URL on non exisiting version
          await expect(
            minterContract.updateVersionURL(
              [0,0,2],
              1,
              "updatedImageURL"
            )
          ).to.be.revertedWith("#Versions: The version does not exist")
        });

        it("reverts when urlKey doesn't exist", async () => {
          // Update image URL on non exisiting version
          await expect(
            minterContract.updateVersionURL(
              [0,0,1],
              3,
              "updatedImageURL"
            )
          ).to.be.revertedWith("#Versions: The url does not exist on that version")
        });

        it("updates version url", async () => {
          // Update animation URL
          await expect(
            minterContract.updateVersionURL(
              [0,0,1],
              1,
              "updatedAnimationURL"
            )
          ).to.emit(minterContract, "VersionURLUpdated")
            .withArgs(
              [0,0,1],
              1,
              "updatedAnimationURL"
            )

          expect(
            await minterContract.getURIs()
          ).to.deep.eq([
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "updatedAnimationURL",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ])

          // Update image URL
          await expect(
            minterContract.updateVersionURL(
              [0,0,1],
              0,
              "updatedImageURL"
            )
          ).to.emit(minterContract, "VersionURLUpdated")
            .withArgs(
              [0,0,1],
              0,
              "updatedImageURL"
            )
          expect(
            await minterContract.getURIs()
          ).to.deep.eq([
            "updatedImageURL",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "updatedAnimationURL",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ])
        });
      });

      describe("#getURIsOfVersion()", () => {
        it("reverts when version doesn't exist", async () => {
          await expect(
             minterContract.getURIsOfVersion([0,0,2])
          ).to.be.revertedWith("#Versions: The version does not exist")
        })
        it("gets URIs",async () => {

          // Update version
          await minterContract.addVersion(
            {
              urls: [
                {
                  url: "",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                },
                {
                  url: "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
                },
                {
                  url: "",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                },
              ],
              label: [0,0,2]
            },
          )

          // version 0.0.1
          expect(
            await minterContract.getURIsOfVersion([0,0,1])
          ).to.deep.eq([
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ])
          // version 0.0.2
          expect(
            await minterContract.getURIsOfVersion([0,0,2])
          ).to.deep.eq([
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ])

        })
      })
      it("#getVersionHistory()", async () => {
        // Update version
        await minterContract.addVersion(
          {
            urls: [
              {
                url: "",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001",
              },
              {
                url: "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
              },
              {
                url: "",
                sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
              }
            ],
            label: [0,0,2]
          }
        )

        const history = await minterContract.getVersionHistory()
        expect(history).to.deep.eq(
          [
            [
              [
                [
                  "",
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
                ],
                [
                  "https://ipfs.io/ipfsbafybeify52a63pgcshhbtkff4nxxxp2zp5yjn2xw43jcy4knwful7ymmgy",
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
                ],
                [
                  "",
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
                ],
              ],
              [0, 0, 1]
            ],
            [
              [
                [
                  "",
                  "0x0000000000000000000000000000000000000000000000000000000000000001"
                ],
                [
                  "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
                  "0x0000000000000000000000000000000000000000000000000000000000000001"
                ],
                [
                  "",
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
                ],
              ],
              [0, 0, 2]
            ]
          ]
        )
      });
      it("emits version added event on creation", async () => {
        await dynamicSketch.createProject(
          projectData(
            "Testing Token",
            "TEST",
            "This is a testing token for all",
            defaultVersion(),
            // 1% royalty since BPS
            10,
            10
          ),
          Implementation.standard
        )
        const editionResult = await dynamicSketch.getProjectAtId(1, Implementation.standard);
        const newMinterContract = (await ethers.getContractAt(
          "StandardProject",
          editionResult
        )) as StandardProject;
        // get VersionAddeded events from newMinterContract
        const filter = newMinterContract.filters.VersionAdded()
        const events = await newMinterContract.queryFilter(filter)
        // expect first event to equal the label of first version
        expect(events[0].args[0]).to.be.deep.eq([0, 0, 1])
      })
      it("updates tokenURI metadata with new urls", async () => {

        // Update version
        await expect (
          minterContract.addVersion(
            {
              urls: [
                {
                  url: "",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                },
                {
                  url: "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000001"
                },
                {
                  url: "",
                  sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                },
              ],
              label: [0,0,2]
            }
          )
        ).to.emit(minterContract, "VersionAdded")

        const updatedTokenURI = await minterContract.tokenURI(1);
        const updatedParsedTokenURI = parseDataURI(updatedTokenURI);
        if (!updatedParsedTokenURI) {
          throw "No parsed token uri";
        }

        // Check metadata from edition
        const updatedUriData = Buffer.from(updatedParsedTokenURI.body).toString("utf-8");
        const updatedMetadata = JSON.parse(updatedUriData);

        expect(JSON.stringify(updatedMetadata)).to.equal(
          JSON.stringify({
            name: "Testing Token 1/10",
            description: "This is a testing token for all",
            animation_url:
              "https://arweave.net/fnfNerUHj64h-J2yU9d-rZ6ZBAQRhrWfkw_fgiKyl2k?id=1"
              + `&address=${minterContract.address.toLowerCase()}`,
            media_version: "0.0.2",
            patch_notes: "",
            properties: { number: 1, name: "Testing Token" },
          })
        );
      });
    });
  });
});
