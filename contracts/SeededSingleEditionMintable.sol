// SPDX-License-Identifier: GPL-3.0

/**

█▄░█ █▀▀ ▀█▀   █▀ █▀▀ █▀▀ █▀▄ █▀▀ █▀▄   █▀▀ █▀▄ █ ▀█▀ █ █▀█ █▄░█ █▀
█░▀█ █▀░ ░█░   ▄█ ██▄ ██▄ █▄▀ ██▄ █▄▀   ██▄ █▄▀ █ ░█░ █ █▄█ █░▀█ ▄█

▀█ █▀█ █▀█ ▄▀█   ▀▄▀   █▀█ █  ▀█▀ ▄▀█
█▄ █▄█ █▀▄ █▀█   █░█   █▄█ █▄ ░█░ █▀█

 */

pragma solidity ^0.8.6;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IERC2981Upgradeable, IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import {SharedNFTLogic, MediaData} from "./SharedNFTLogic.sol";
import {ISeededEditionSingleMintable, MintData} from "./ISeededEditionSingleMintable.sol";
import {Versions} from "./Versions.sol";

/**
    This is a smart contract for handling dynamic contract minting.

    This is a fork of Zora NFT Editions
    changes:
        - Media urls are versioned allowing for updatable content preserving history
        - The NFT contract address is included in edition url query for easyier access to query the graph from within the NFT
        - SupportsInterface function includes IEditionSingleMintable

    @dev This allows creators to mint a unique serial edition of the same media within a custom contract
    @author iain nash
    Repository: https://github.com/ourzora/nft-editions
*/
contract SeededSingleEditionMintable is
    ERC721Upgradeable,
    ISeededEditionSingleMintable,
    IERC2981Upgradeable,
    OwnableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using Versions for Versions.Set;
    event PriceChanged(uint256 amount);
    event EditionSold(uint256 price, address owner);

    /**
     @param label the semantic version label that the url is being updated
     @param index the url index 0 = image, 1 = animation
     @param url the url to be updated to
    */
    event VersionURLUpdated(uint8[3] label, uint8 index, string url);

    /**
     @param label the semantic version label added
    */
    event VersionAdded(uint8[3] label);

    /**
     @param owner the address of the owner of the editions contract
     @param minter the address of the approved minter
     @param approved a boolean indicating the approval status
    */
    event ApprovedMinter(address indexed owner, address indexed minter, bool approved);

    // metadata
    string public description;

    // Media Urls
    enum URLS  {
        Image,
        Animation
    }
    // Versions of Media Urls
    Versions.Set private versions;

    // Total size of edition that can be minted
    uint256 public editionSize;
    // Current token id minted
    CountersUpgradeable.Counter private atEditionId;
    // Royalty amount in bps
    uint256 public royaltyBPS;
    // Addresses allowed to mint edition
    mapping(address => bool) allowedMinters;

    // Mapping from seed to bool
    mapping(uint256 => bool) public seedsUsed;
    // Mapping from tokenId to seed
    mapping(uint256 => uint256) public seedOfTokens;

    // Price for sale
    uint256 public salePrice;

    // NFT rendering logic contract
    SharedNFTLogic private immutable sharedNFTLogic;

    // Global constructor for factory
    constructor(SharedNFTLogic _sharedNFTLogic) {
        sharedNFTLogic = _sharedNFTLogic;
    }

    /**
      @param _owner User that owns and can mint the edition, gets royalty and sales payouts and can update the base url if needed.
      @param _name Name of edition, used in the title as "$NAME NUMBER/TOTAL"
      @param _symbol Symbol of the new token contract
      @param _description Description of edition, used in the description field of the NFT
      @param _version Version of the media consisting of urls and hashes of animation and image content
      @param _editionSize Number of editions that can be minted in total. If 0, unlimited editions can be minted.
      @param _royaltyBPS BPS of the royalty set on the contract. Can be 0 for no royalty.
      @dev Function to create a new edition. Can only be called by the allowed creator
           Sets the only allowed minter to the address that creates/owns the edition.
           This can be re-assigned or updated later
     */
    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        string memory _description,
        Versions.Version memory _version,
        uint256 _editionSize,
        uint256 _royaltyBPS
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init();
        // Set ownership to original sender of contract call
        transferOwnership(_owner);
        description = _description;
        editionSize = _editionSize;
        royaltyBPS = _royaltyBPS;
        // Set edition id start to be 1 not 0
        atEditionId.increment();

        // Add first version
        versions.addVersion(_version);
        emit VersionAdded(_version.label);
    }


    /// @dev returns the number of minted tokens within the edition
    function totalSupply() public view returns (uint256) {
        return atEditionId.current() - 1;
    }
    /**
        Simple eth-based sales function
        More complex sales functions can be implemented through ISingleEditionMintable interface
     */

    /**
      @dev This allows the user to purchase a edition edition
           at the given price in the contract.
      @param seed the chosen seed number
     */
    function purchase(uint256 seed) external payable returns (uint256) {
        require(salePrice > 0, "Not for sale");
        require(msg.value == salePrice, "Wrong price");
        MintData[] memory toMint = new MintData[](1);
        toMint[0] = MintData(msg.sender, seed);
        emit EditionSold(salePrice, msg.sender);
        return _mintEditions(toMint);
    }

    /**
      @param _salePrice if sale price is 0 sale is stopped, otherwise that amount 
                       of ETH is needed to start the sale.
      @dev This sets a simple ETH sales price
           Setting a sales price allows users to mint the edition until it sells out.
           For more granular sales, use an external sales contract.
     */
    function setSalePrice(uint256 _salePrice) external onlyOwner {
        salePrice = _salePrice;
        emit PriceChanged(salePrice);
    }

    /**
      @dev This withdraws ETH from the contract to the contract owner.
     */
    function withdraw() external onlyOwner {
        // No need for gas limit to trusted address.
        AddressUpgradeable.sendValue(payable(owner()), address(this).balance);
    }

    /**
      @dev This helper function checks if the msg.sender is allowed to mint the
            given edition id.
     */
    function _isAllowedToMint() internal view returns (bool) {
        if (owner() == msg.sender) {
            return true;
        }
        if (allowedMinters[address(0x0)]) {
            return true;
        }
        return allowedMinters[msg.sender];
    }

    /**
      @param to address to send the newly minted edition to
      @param seed number of the chosen seed
      @dev This mints one edition to the given address by an allowed minter on the edition instance.
     */
    function mintEdition(address to, uint256 seed) external override returns (uint256) {
        require(_isAllowedToMint(), "Needs to be an allowed minter");
        MintData[] memory toMint = new MintData[](1);
        toMint[0] = MintData(to, seed);
        return _mintEditions(toMint);
    }

    /**
      @param recipients list of addresses and seeds to send the newly minted editions to
      @dev This mints multiple editions to the given list of addresses.
     */
    function mintEditions(MintData[] memory recipients)
        external
        override
        returns (uint256)
    {
        require(_isAllowedToMint(), "Needs to be an allowed minter");
        return _mintEditions(recipients);
    }

    /**
        Simple override for owner interface.
     */
    function owner()
        public
        view
        override(OwnableUpgradeable, ISeededEditionSingleMintable)
        returns (address)
    {
        return super.owner();
    }

    /**
      @param minter address to set approved minting status for
      @param allowed boolean if that address is allowed to mint
      @dev Sets the approved minting status of the given address.
           This requires that msg.sender is the owner of the given edition id.
           If the ZeroAddress (address(0x0)) is set as a minter,
             anyone will be allowed to mint.
           This setup is similar to setApprovalForAll in the ERC721 spec.
     */
    function setApprovedMinter(address minter, bool allowed) public onlyOwner {
        allowedMinters[minter] = allowed;
        emit ApprovedMinter(_msgSender(), minter, allowed);
    }

    /**
      @dev Updates a url of specified version by the owner of the edition.
           Only URLs can be updated (data-uris are supported), hashes cannot be updated.
      @param _label The label of the specified version
      @param _urlKey The index of the url to update 0=animation, 1=image
      @param _url The url to be updated to
     */
    function updateVersionURL(
        uint8[3] memory _label,
        uint8 _urlKey,
        string memory _url
    ) public onlyOwner {
        versions.updateVersionURL(_label, _urlKey, _url);
        emit VersionURLUpdated(_label, _urlKey, _url);
    }

    /**
      @dev Adds new version of the media updating the urls rendered in the metadata.
           The order added determins order stored, the label has no effect.
      @param _version The version to be added consisting of urls, hashes and a label
     */
    function addVersion(
        Versions.Version memory _version
    ) public onlyOwner {
        versions.addVersion(_version);
        emit VersionAdded(_version.label);
    }

    function getVersionHistory()
        public
        view
        returns (Versions.Version[] memory)
    {
        return versions.getAllVersions();
    }

    /**
     @dev returns the number of editions allowed to mint (max_uint256 when open edition)
     @return allowedToMint the number of editions allowed to mint
    */
    function numberCanMint() public view override returns (uint256) {
        // Return max int if open edition
        if (editionSize == 0) {
            return type(uint256).max;
        }
        // atEditionId is one-indexed hence the need to remove one here
        return editionSize + 1 - atEditionId.current();
    }

    /**
        @dev burns token id if owner or approved owner
        @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) public {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Not approved");
        _burn(tokenId);
    }

    /**
        @dev checks if seed is in valid range, between 1 and editionSize
        @param seed uint256 of the seed
        @return isInRange boolean representing if the seed is in the valid range
    */
    function _isSeedInRange(uint256 seed) private view returns (bool) {
        return ((seed > 0) && (seed <= editionSize));
    }

    /**
        @dev internal function that allocates seed number to nft id
        @param tokenId Token ID for the seed to be allocated to
        @param seed Seed to be used
    */
    function _useSeed(uint256 tokenId, uint256 seed) internal {
        // check if seed has been used
        require(seedsUsed[seed] == false, "Seed already used");
        // check if seed is out of range
        require(_isSeedInRange(seed), "Seed out of range");

        // allocate seed to id
        seedsUsed[seed] = true;
        seedOfTokens[tokenId] = seed;
    }

    /**
      @dev Private function to mint als without any access checks.
           Called by the public edition minting functions.
           allocates requested seeds
     */
    function _mintEditions(MintData[] memory recipients)
        internal
        returns (uint256)
    {
        uint256 startAt = atEditionId.current();
        uint256 endAt = startAt + recipients.length - 1;
        require(editionSize == 0 || endAt <= editionSize, "Sold out");

        while (atEditionId.current() <= endAt) {
            _useSeed(
                atEditionId.current(),
                recipients[atEditionId.current() - startAt].seed
            );

            _mint(
                recipients[atEditionId.current() - startAt].to,
                atEditionId.current()
            );
            atEditionId.increment();
        }
        return atEditionId.current();
    }

    /**
      @dev Get URIs for edition NFT, will retrieve URIs from the last added version
      @return imageUrl The url of the image
      @return imageHash  A sha-256 hash of the content on the imageUrl, will be zero address if url blank
      @return animationUrl The url of the animation
      @return animationHash A sha-256 hash of the content on the animationUrl, will be zero address if url blank
     */
    function getURIs()
        public
        view
        returns (
            string memory,
            bytes32,
            string memory,
            bytes32
        )
    {
        Versions.Version memory latest = versions.getLatestVersion();
        return (
            latest.urls[uint8(URLS.Image)].url,
            latest.urls[uint8(URLS.Image)].sha256hash,
            latest.urls[uint8(URLS.Animation)].url,
            latest.urls[uint8(URLS.Animation)].sha256hash
        );
    }

    /**
      @dev Get URIs for edition NFT of a version
           Will get URIs from the last version added
      @param label The label of the version
      @return imageUrl
      @return imageHash
      @return animationUrl
      @return animationHash
     */
    function getURIsOfVersion(
        uint8[3] memory label
    )
        public
        view
        returns (
            string memory,
            bytes32,
            string memory,
            bytes32
        )
    {
        Versions.Version memory version = versions.getVersion(label);
        return (
            version.urls[uint8(URLS.Image)].url,
            version.urls[uint8(URLS.Image)].sha256hash,
            version.urls[uint8(URLS.Animation)].url,
            version.urls[uint8(URLS.Animation)].sha256hash
        );
    }

    /**
        @dev Get royalty information for token
        @param _salePrice Sale price for the token
     */
    function royaltyInfo(uint256, uint256 _salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        if (owner() == address(0x0)) {
            return (owner(), 0);
        }
        return (owner(), (_salePrice * royaltyBPS) / 10_000);
    }

    /**
        @dev Get URI for given token id, will retrieve URIs from the last added version
        @param tokenId token id to get uri for
        @return metadata base64-encoded json metadata object
    */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "No token");
        Versions.Version memory version = versions.getLatestVersion();
        return
            sharedNFTLogic.createMetadataEdition(
                name(),
                description,
                MediaData(
                    version.urls[uint8(URLS.Image)].url,
                    version.urls[uint8(URLS.Animation)].url,
                    version.label
                ),
                tokenId,
                editionSize,
                address(this),
                seedOfTokens[tokenId]
            );
    }

    /**
        @dev Get URI for given token id of given version
        @param tokenId token id to get uri for
        @param label the label of the version
        @return metadata base64-encoded json metadata object
    */
    function tokenURIOfVersion(
        uint256 tokenId,
        uint8[3] memory label
    )
        public
        view
        returns (string memory)
    {
        require(_exists(tokenId), "No token");
        Versions.Version memory version = versions.getVersion(label);

        return
            sharedNFTLogic.createMetadataEdition(
                name(),
                description,
                MediaData(
                    version.urls[uint8(URLS.Image)].url,
                    version.urls[uint8(URLS.Animation)].url,
                    version.label
                ),
                tokenId,
                editionSize,
                address(this),
                seedOfTokens[tokenId]
            );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return
            type(ISeededEditionSingleMintable).interfaceId == interfaceId ||
            type(IERC2981Upgradeable).interfaceId == interfaceId ||
            ERC721Upgradeable.supportsInterface(interfaceId);
    }
}
