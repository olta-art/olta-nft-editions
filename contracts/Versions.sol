// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

/// Versioning for NFT metadata

/*
    [WIP] don't use in production, just yet

    TODO:

    [x] needs to store a history of versions {}
    [x] needs to be able to add version (external write creatorOnly)
    [x] needs to retrieve all versions (public pure read)
    [x] needs to retrieve latest version (public pure read) -> so animationURL can be dynamiclly updated
    [ ] do we need a delete? - what if we flag versions instead?

    [ ] do we need patch notes?

    Is now a libary in the hope of reducing gas for nfts
    Include with `using Versions for Versions.Set;`

    NOTE: unit8[3] labeling is used is it keeps it neat and limits storage
*/

library Versions {

    // NOTE: store 'key' in mapping for easy access
    // NOTE: uint8[3] enforce number only labeling - may be handy to order on contract
    struct Version {
        string url;
        bytes32 sha256hash;
        uint8[3] label;
    }

    /// NOTE: can't use unit8[3] as key for mapping so will need to convert to string
    // store labels as keys ?
    struct Set {
        string[] labels;
        mapping(string => Version) versions;
    }

    function createVersion(
        string memory url,
        bytes32 sha256hash,
        uint8[3] memory label
    )
        internal
        pure
        returns (Version memory)
    {
        return Version(
            url,
            sha256hash,
            label
        );
    }

    function addVersion(
        Set storage set,
        Version memory version
    ) internal {

        string memory labelKey = uintArray3ToString(version.label);

        require(
            bytes(
                set.versions[labelKey].url
            ).length == 0,
            "A version with that label already exists"
        );

        // add to labels array
        set.labels.push(labelKey);

        // store url and hash in mapping
        set.versions[labelKey] = version;
    }

    function getVersion(
        Set storage set,
        uint8[3] memory label
    )
        internal
        view
        returns (Version memory)
    {
        return set.versions[uintArray3ToString(label)];
    }

    // NOTE: only update url is possible and should result in same hash
    function updateVersionURL(
        Set storage set,
        uint8[3] memory label,
        string memory newUrl
    ) internal {
        set.versions[uintArray3ToString(label)].url = newUrl;
    }

    function getAllLabels(
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
        return getVersionsFromLabels(set, set.labels);
    }

    // get history of versions from array of labels
    // returns array of versions
    function getVersionsFromLabels(
        Set storage set,
        string[] memory _labels
    )
        internal
        view
        returns (Version[] memory)
    {
        Version[] memory versionArray = new Version[](_labels.length);

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

    // NOTE: public to be used in SharedNFTLogic
    function uintArray3ToString (uint8[3] memory label)
        public
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(
            StringsUpgradeable.toString(label[0]),
            ".",
            StringsUpgradeable.toString(label[1]),
            ".",
            StringsUpgradeable.toString(label[2])
        ));
    }
}