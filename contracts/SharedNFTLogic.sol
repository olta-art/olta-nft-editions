// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.6;

import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {Base64} from "base64-sol/base64.sol";
import {IPublicSharedMetadata} from "./IPublicSharedMetadata.sol";
import {Versions} from "./Versions.sol";

struct MediaData{
    string imageUrl;
    string animationUrl;
    uint8[3] label;
}

/// Shared NFT logic for rendering metadata associated with editions
/// @dev Can safely be used for generic base64Encode and numberToString functions
contract SharedNFTLogic is IPublicSharedMetadata {
    /// @param unencoded bytes to base64-encode
    function base64Encode(bytes memory unencoded)
        public
        pure
        override
        returns (string memory)
    {
        return Base64.encode(unencoded);
    }

    /// Proxy to openzeppelin's toString function
    /// @param value number to return as a string
    function numberToString(uint256 value)
        public
        pure
        override
        returns (string memory)
    {
        return StringsUpgradeable.toString(value);
    }

    /// @notice converts address to string
    /// @param _address address to return as a string
    function addressToString(address _address) public pure returns(string memory) {
        bytes20 _bytes = bytes20(_address);
        bytes memory HEX = "0123456789abcdef";
        bytes memory _string = new bytes(42);
        _string[0] = '0';
        _string[1] = 'x';
        for(uint i = 0; i < 20; i++) {
            _string[2+i*2] = HEX[uint8(_bytes[i] >> 4)];
            _string[3+i*2] = HEX[uint8(_bytes[i] & 0x0f)];
        }
        return string(_string);
    }

    // Proxy to olta's uintArray3ToString function
    function uintArray3ToString (uint8[3] memory label)
        public
        pure
        returns (string memory)
    {
        return Versions.uintArray3ToString(label);
    }

    /// Generate edition metadata from storage information as base64-json blob
    /// Combines the media data and metadata
    /// @param name Name of NFT in metadata
    /// @param description Description of NFT in metadata
    /// @param media The image Url, animation Url and version label of the media to be rendered
    /// @param tokenOfEdition Token ID for specific token
    /// @param editionSize Size of entire edition to show
    /// @param tokenAddress Address of the NFT
    function createMetadataEdition(
        string memory name,
        string memory description,
        MediaData memory media,
        uint256 tokenOfEdition,
        uint256 editionSize,
        address tokenAddress
    ) external pure returns (string memory) {
        string memory _tokenMediaData = tokenMediaData(
            media,
            tokenOfEdition,
            tokenAddress
        );
        bytes memory json = createMetadataJSON(
            name,
            description,
            _tokenMediaData,
            tokenOfEdition,
            editionSize
        );
        return encodeMetadataJSON(json);
    }

    /// Generate edition metadata from storage information as base64-json blob
    /// Combines the media data and metadata
    /// @param name Name of NFT in metadata
    /// @param description Description of NFT in metadata
    /// @param media The image Url, animation Url and version label of the media to be rendered
    /// @param tokenOfEdition Token ID for specific token
    /// @param editionSize Size of entire edition to show
    /// @param tokenAddress Address of the NFT
    function createMetadataEdition(
        string memory name,
        string memory description,
        MediaData memory media,
        uint256 tokenOfEdition,
        uint256 editionSize,
        address tokenAddress,
        uint256 tokenSeed
    ) external pure returns (string memory) {
        string memory _tokenMediaData = tokenMediaData(
            media,
            tokenOfEdition,
            tokenAddress,
            tokenSeed
        );
        bytes memory json = createMetadataJSON(
            name,
            description,
            _tokenMediaData,
            tokenOfEdition,
            editionSize
        );
        return encodeMetadataJSON(json);
    }

    /// Function to create the metadata json string for the nft edition
    /// @param name Name of NFT in metadata
    /// @param description Description of NFT in metadata
    /// @param mediaData Data for media to include in json object
    /// @param tokenOfEdition Token ID for specific token
    /// @param editionSize Size of entire edition to show
    function createMetadataJSON(
        string memory name,
        string memory description,
        string memory mediaData,
        uint256 tokenOfEdition,
        uint256 editionSize
    ) public pure returns (bytes memory) {
        bytes memory editionSizeText;
        if (editionSize > 0) {
            editionSizeText = abi.encodePacked(
                "/",
                numberToString(editionSize)
            );
        }
        return
            abi.encodePacked(
                '{"name": "',
                name,
                " ",
                numberToString(tokenOfEdition),
                editionSizeText,
                '", "',
                'description": "',
                description,
                '", "',
                mediaData,
                'properties": {"number": ',
                numberToString(tokenOfEdition),
                ', "name": "',
                name,
                '"}}'
            );
    }

    /// Encodes the argument json bytes into base64-data uri format
    /// @param json Raw json to base64 and turn into a data-uri
    function encodeMetadataJSON(bytes memory json)
        public
        pure
        override
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    base64Encode(json)
                )
            );
    }

    /// Generates edition metadata from storage information as base64-json blob
    /// Combines the media data and metadata
    /// @param media urls of image and animation media with version label
    function tokenMediaData(
        MediaData memory media,
        uint256 tokenOfEdition,
        address tokenAddress
    ) public pure returns (string memory) {
        bool hasImage = bytes(media.imageUrl).length > 0;
        bool hasAnimation = bytes(media.animationUrl).length > 0;
        if (hasImage && hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        imageUrl(
                            media.imageUrl,
                            tokenOfEdition
                        ),
                        animationUrl(
                            media.animationUrl,
                            tokenOfEdition,
                            tokenAddress
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }
        if (hasImage) {
            return
                string(
                    abi.encodePacked(
                        imageUrl(
                            media.imageUrl,
                            tokenOfEdition
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }
        if (hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        animationUrl(
                            media.animationUrl,
                            tokenOfEdition,
                            tokenAddress
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }

        return "";
    }

    /// Generates edition metadata from storage information as base64-json blob
    /// Combines the media data and metadata
    /// @param media urls of image and animation media with version label
    function tokenMediaData(
        MediaData memory media,
        uint256 tokenOfEdition,
        address tokenAddress,
        uint256 tokenSeed
    ) public pure returns (string memory) {
        bool hasImage = bytes(media.imageUrl).length > 0;
        bool hasAnimation = bytes(media.animationUrl).length > 0;
        if (hasImage && hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        imageUrl(
                            media.imageUrl,
                            tokenSeed
                        ),
                        animationUrl(
                            media.animationUrl,
                            tokenOfEdition,
                            tokenAddress,
                            tokenSeed
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }
        if (hasImage) {
            return
                string(
                    abi.encodePacked(
                        imageUrl(
                            media.imageUrl,
                            tokenSeed
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }
        if (hasAnimation) {
            return
                string(
                    abi.encodePacked(
                        animationUrl(
                            media.animationUrl,
                            tokenOfEdition,
                            tokenAddress,
                            tokenSeed
                        ),
                        version(
                            media.label
                        )
                    )
                );
        }

        return "";
    }

    function version(
        uint8[3] memory label
    ) public pure returns (string memory) {
        return string (
            abi.encodePacked(
                'media_version": "',
                uintArray3ToString(label),
                '", "'
            )
        );
    }

    function imageUrl(
        string memory url,
        uint256 id
    ) public pure returns (string memory) {
        return string (
            abi.encodePacked(
                'image": "',
                url,
                 "?id=", // if just url "/id" this will work with arweave pathmanifests
                numberToString(id),
                '", "'
            )
        );
    }

    function animationUrl(
        string memory url,
        uint256 tokenId,
        address tokenAddress
    ) public pure returns (string memory) {
        return string (
            abi.encodePacked(
                'animation_url": "',
                url,
                "?id=",
                numberToString(tokenId),
                "&address=",
                addressToString(tokenAddress),
                '", "'
            )
        );
    }

    function animationUrl(
        string memory url,
        uint256 tokenId,
        address tokenAddress,
        uint256 seed
    ) public pure returns (string memory) {
        return string (
            abi.encodePacked(
                'animation_url": "',
                url,
                "?id=",
                numberToString(tokenId),
                "&address=",
                addressToString(tokenAddress),
                "&seed=",
                numberToString(seed),
                '", "'
            )
        );
    }
}
