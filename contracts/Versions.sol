// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

/// Versioning for NFT metadata

/*
    Rough plan [WIP] DO NOT USE

    each version = {
        animationURL
        animationHash
        label - do I enforce a "0.0.0" label? would make it easy to find latest
    }

    [x] needs to store a history of versions {}
    [x] needs to be able to add version (external write creatorOnly)
    [ ] do we need a delete? - what if we flag versions instead?
    [x] needs to retrieve all versions (public pure read)
    [x] needs to retrieve latest version (public pure read) -> so animationURL can be dynamiclly updated
    [ ] needs to only be editable by creator
    [ ] needs to encode as json
    [ ] make everything pure function and have storage handled by NFT contract
    [ ] add events
*/

contract Versions {


    // NOTE: store 'key' in mapping for easy access
    // NOTE: uint256[3] enforce number only labeling - may be handy to order on contract
    struct Version {
        string animationURL;
        string animationHash;
        uint256[3] label;
    }

    /// NOTE: can't use unit256[3] as key for mapping so will need to convert to string
    // store labels as keys ?
    string[] public labels;

    mapping(string => Version) versions;

    address owner;

    constructor(
        address _owner,
        string memory _animationURL,
        string memory _animationHash,
        uint256[3] memory _label
    )
    {
        owner =_owner;
        _addVersion(
            _animationURL,
            _animationHash,
            _label
        );
    }

    // TODO: make creator only
    function addVersion(
        string memory animationURL,
        string memory animationHash,
        uint256[3] memory label
    ) external {
        _addVersion(animationURL, animationHash, label);
    }

    // NOTE: only update url is possible and should result in same hash
    // TODO: make creator only
    function updateVersionURL(
        uint256[3] memory label,
        string memory newAnimationURL
    ) external {
        versions[uintArray3ToString(label)].animationURL = newAnimationURL;
    }

    function _addVersion(
        string memory animationURL,
        string memory animationHash,
        uint256[3] memory label
    ) internal {

        string memory labelKey = uintArray3ToString(label);

        require(
            bytes(
                versions[labelKey].animationURL
            ).length == 0,
            "A version with that label already exists"
        );

        // add to labels array
        labels.push(labelKey);

        // store url and hash in mapping
        versions[labelKey] = Version(
            animationURL,
            animationHash,
            label
        );
    }


    function createVersionData(
        Version memory version,
        uint256 tokenOfEdition,
        address tokenAddress
    )
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                '"animation_url": "',
                version.animationURL,
                "?id=",
                numberToString(tokenOfEdition),
                "&address=",
                addressToString(tokenAddress),
                '",  "animation_hash": "',
                version.animationHash,
                '", "version_label": "',
                uintArray3ToString(version.label),
                '"'
            );
    }

    // get history of versions as an array of versions
    // NOTE: see bottom for attempt to make pure... but seems imposible
    function getVersions(string[] memory _labels)
        public
        view
        returns (Version[] memory)
    {
        Version[] memory versionArray = new Version[](_labels.length - 1);

        for (uint256 index = 0; index < _labels.length; index++) {
                versionArray[index] = versions[_labels[index]];
        }

        return versionArray;
    }

    // get latest
    // NOTE: presumes it's the last added
    function getLatestVersion() external view returns (Version memory) {
        return versions[
            labels[labels.length - 1]
        ];
    }

    function getVersion(uint256[3] calldata label) external view returns (Version memory) {
        return versions[uintArray3ToString(label)];
    }

    // TODO: work out if internal or public is better for this
    function uintArray3ToString (uint256[3] memory label)
        public
        pure
        returns (string memory)
    {
        // may be better to just store as string if we don't need to worry about order
        return string(abi.encodePacked(
            label[0],
            ".",
            label[1],
            ".",
            label[2]
        ));
    }

    /// @notice converts address to string
    /// @param _address address to return as a string
    function addressToString(address _address)
        public
        pure
        returns(string memory)
    {
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

    /// Proxy to openzeppelin's toString function
    /// @param value number to return as a string
    function numberToString(uint256 value)
        public
        pure
        returns (string memory)
    {
        return StringsUpgradeable.toString(value);
    }

}



    // function find(string memory label) public returns(uint256) {
    //     uint i = 0;
    //     while (labels[i] != label) {
    //         i++;
    //     }
    //     return i;
    // }

    // function removeByIndex(uint i) public {
    //     while (i<labels.length-1) {
    //         labels[i] = labels[i+1];
    //         i++;
    //     }
    //     labels.length--;
    // }

    // function removeVersion(
    //     string memory label
    // ) external {
    //     require(
    //         bytes(versions[label].animationURL).length != 0,
    //         "version not found"
    //     );

    //     labels.pop();

    //     // reset mapping
    //     versions[label] = Version(
    //         "",
    //         ""
    //     );
    // }

        // get history of versions as json type data
    // NOTE: is this needed? 
    // function getVersions(string[] memory _labels) public view returns (bytes memory){
    //     bytes memory versionList = abi.encodePacked('"[');

    //     for (uint256 index = 0; index < _labels.length; index++) {
    //         Version memory version = versions[labels[index]];
    //         versionList = abi.encodePacked(
    //             versionList,
    //             '{',
    //             createVersionData(
    //                 version.animationURL,
    //                 version.animationHash,
    //                 version.label
    //             ),
    //             '}'
    //         );
    //     }

    //     versionList = abi.encode(versionList, ']"');

    //     return versionList;
    // }

     // NOTE: can't make pure becuase need versions mapping and it has nested mapping 
    // closest I can get to pure for now ... but requires storage input 
    // function getVersions(string[] memory _labels, mapping(string => Version) storage _versions)
    //     internal
    //     view
    //     returns (Version[] memory)
    // {
    //     Version[] memory versionArray = new Version[](_labels.length - 1);

    //     for (uint256 index = 0; index < _labels.length; index++) {
    //             versionArray[index] = _versions[_labels[index]];
    //     }

    //     return versionArray;
    // }

