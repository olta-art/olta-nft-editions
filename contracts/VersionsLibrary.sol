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
    [x] needs to retrieve all versions (public pure read)
    [x] needs to retrieve latest version (public pure read) -> so animationURL can be dynamiclly updated
    [ ] do we need a delete? - what if we flag versions instead? <- flags probs DDos vector?
    [ ] needs to only be editable by creator
    [ ] needs to encode as json
    [ ] make everything pure function and have storage handled by NFT contract
    [ ] add events

    Is now a libary in the hope of reducing gas for nfts
    Include with `using Versions for Versions.Set;`
*/

library Versions {


    // NOTE: store 'key' in mapping for easy access
    // NOTE: uint256[3] enforce number only labeling - may be handy to order on contract
    struct Version {
        string animationURL;
        string animationHash;
        uint256[3] label;
    }

    /// NOTE: can't use unit256[3] as key for mapping so will need to convert to string
    // store labels as keys ?
    struct Set {
        string[] labels;
        mapping(string => Version) versions;
    }

    // TODO: make creator only
    function addVersion(
        Set storage set,
        Version memory version
    ) internal {
        _addVersion(set, version);
    }

    function _addVersion(
        Set storage set,
        Version memory version
    ) internal {

        string memory labelKey = uintArray3ToString(version.label);

        require(
            bytes(
                set.versions[labelKey].animationURL
            ).length == 0,
            "A version with that label already exists"
        );

        // add to labels array
        set.labels.push(labelKey);

        // store url and hash in mapping
        set.versions[labelKey] = version;
    }

    // NOTE: only update url is possible and should result in same hash
    // TODO: make creator only
    function updateVersionURL(
        Set storage set,
        uint256[3] memory label,
        string memory newAnimationURL
    ) internal {
        set.versions[uintArray3ToString(label)].animationURL = newAnimationURL;
    }

    function getVersionLabels(
        Set storage set
    )
        internal
        view
        returns (string[] memory)
    {
        return set.labels;
    }

    function getAllVersions(
        Set storage set
    )
        internal
        view
        returns (Version[] memory)
    {
        return getVersions(set, set.labels);
    }

    // get history of versions from array of labels
    // returns array of versions
    function getVersions(
        Set storage set,
        string[] memory _labels
    )
        internal
        view
        returns (Version[] memory)
    {
        Version[] memory versionArray = new Version[](_labels.length - 1);

        for (uint256 index = 0; index < _labels.length; index++) {
                versionArray[index] = set.versions[_labels[index]];
        }

        return versionArray;
    }

    // get latest
    // NOTE: presumes it's the last added
    function getLatestVersion(
        Set storage set
    )
        internal
        view
        returns (Version memory)
    {
        return set.versions[
            set.labels[set.labels.length - 1]
        ];
    }

    function getVersion(
        Set storage set,
        uint256[3] memory label
    )
        internal
        view
        returns (Version memory)
    {
        return set.versions[uintArray3ToString(label)];
    }

    // TODO: move to sharedNFT logic ?
    // Won't work in libary as first param is no set
    function createVersionData(
        Version memory version,
        uint256 tokenOfEdition,
        address tokenAddress
    )
        internal
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

    // TODO: work out if internal or public is better for this
    function uintArray3ToString (uint256[3] memory label)
        internal
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

