# Olta Editions [WIP]

These are a fork of [Zora NFT Editions](https://github.com/ourzora/nft-editions) with a few additions with a specific focus on NFT's with webpage content.

## These contracts are in beta
They are well tested in-house but they haven't been used in the wild all that much. It's advised to deploy and thoroughly test your project on mumbai first.

### What have we changed?
1. Added versioning for the animation and image urls. The implementation makes use of `Versions.sol` library contract to store a history of versions
2. Added the project contract address to the animation url for easier querying of subgraphs from within the NFT content.
3. Support interface check for `IStandardProject.sol`/`ISeededProject.sol` useful for checking sales contracts.
4. Added two project implementations with the ability to add more.
5. The projectCreator contract is upgradable
6. Mumbai deployments are open for anyone to create new projects
7. Polygon is currently only curated artists only

### How does versioning work?
- Each version consist of an animation url, animation content hash, image url, image content hash and a version label.
- The last added version is assumed to be the latest and used for generating the metadata (this may change)
- It is still possible to update urls of a version.
- The versioning label follows the [semantic versioning](https://semver.org/) specification. This is to keep things neat and more easily order versions off-chain. The exact implementation uses is an array `[uint8, uint8, uint8]` limiting the max increment to 255.

An example of a version:
```
{
   urls: [
      // image
      {
         url: "https://url-of-thumbnail.com",,
         sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      },
      // animation
      {
         url: "https://url-of-live-artwork.com",
         sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
      // patch notes
      {
         url: "https://url-of-patch-notes-text-file.com",
         sha256hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
   ],
   label: [0,0,1]
}

```


### What are these contracts?
1. `StandardProject`
   Each edition is a unique contract.
   This allows for easy royalty collection, clear ownership of the collection, and your own contract 🎉
2. `ProjectCreator`
   Gas-optimized factory contract allowing you to easily + for a low gas transaction create your own edition mintable contract.
3. `SharedNFTLogic`
   Contract that includes dynamic metadata generation for your editions removing the need for a centralized server.
   imageUrl and animationUrl can be base64-encoded data-uris for these contracts totally removing the need for IPFS

### Where are the contracts deployed:

#### polygon
| Name | Address |
|---|---|
| ProjectCreator_Proxy | [0x17F92AE6d8770CE4Ee689f188Bcc83e1Ab1e58d4](https://polygonscan.com/address/0x17F92AE6d8770CE4Ee689f188Bcc83e1Ab1e58d4) |
| StandardProject | [0xD68FFD0b6D54EB86A083eA167aF1c9e504075fCd](https://polygonscan.com/address/0xD68FFD0b6D54EB86A083eA167aF1c9e504075fCd) |
| SeededProject | [0x321D8f554847bA2E0ad8fe6aF289620eedf95F67](https://polygonscan.com/address/0x321D8f554847bA2E0ad8fe6aF289620eedf95F67) |
| SharedNFTLogic | [0x92419d3c2ce2EF407F8705cf1A85b131bBcebf01](https://polygonscan.com/address/0x92419d3c2ce2EF407F8705cf1A85b131bBcebf01) |
| Versions | [0x26a7811cd374AE3140d302F64567Af2E3c18106e](https://polygonscan.com/address/0x26a7811cd374AE3140d302F64567Af2E3c18106e) |


#### mumbai
| Name | Address |
|---|---|
| ProjectCreator | [0x0bEc046DDbA18894088Bf4130AbD8496b8dff154](https://mumbai.polygonscan.com/address/0x0bEc046DDbA18894088Bf4130AbD8496b8dff154) |

### How do I create a new edition?

call `createProject` with the given arguments to create a new project:

- EditionData: an object containing the following
> - Name: Token Name Symbol (shows in etherscan)
> - Symbol: Symbol of the Token (shows in etherscan)
> - Description: Description of the Token (shows in the NFT description)
> - Version: an object with the structure of the example version above
> - Edition Size: Number of this edition, if set to 0 edition is not capped/limited
> - BPS Royalty: 500 = 5%, 1000 = 10%, so on and so forth, set to 0 for no on-chain royalty (not supported by all marketplaces)
- Implementation: a number specificing the type of singleEditionMintable contract.

See tests for examples.

### How do I sell/distribute editions?

Now that you have a edition, there are multiple options for lazy-minting and sales:

1. To sell editions for ETH you can call `setSalePrice`
2. To allow certain accounts to mint `setApprovedMinter(address, approved)`.
3. To mint yourself to a list of addresses you can call `mintEditions(addresses[])` to mint an edition to each address in the list.

### Benefits of these contracts:

* Full ownership of your own created minting contract
* Each serial gets its own minting contract
* Gas-optimized over creating individual NFTs
* Fully compatible with ERC721 marketplaces / auction houses / tools
* Supports tracking unique parts (edition 1 vs 24 may have different pricing implications) of editions
* Supports free public minting (by approving the 0x0 (zeroaddress) to mint)
* Supports smart-contract based minting (by approving the custom minting smart contract) using an interface.
* All metadata is stored/generated on-chain --only image/video assets are stored off-chain
* Permissionless and open-source
* Simple integrated ethereum-based sales, can be easily extended with custom interface code
