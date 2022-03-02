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
    [x] store any number of urls

    [ ] do we need patch notes?

    Is now a libary in the hope of reducing gas for nfts
    Include with `using Versions for Versions.Set;`

    NOTE: unit8[3] labeling is used is it keeps it neat and limits storage
*/

library Versions {

    struct UrlWithHash {
        string url;
        bytes32 sha256hash;
    }

    // NOTE: store 'key' in mapping for easy access
    // NOTE: uint8[3] enforce number only labeling - may be handy to order on contract
    struct Version {
        UrlWithHash[] urls;
        uint8[3] label;
    }

    /// NOTE: can't use unit8[3] as key for mapping so will need to convert to string
    // store labels as keys ?
    struct Set {
        string[] labels;
        mapping(string => Version) versions;
    }

    function createVersion(
        UrlWithHash[] memory urls,
        uint8[3] memory label
    )
        internal
        pure
        returns (Version memory)
    {
        Version memory version = Version(urls, label);
        return version;
    }

    function addVersion(
        Set storage set,
        Version memory version
    ) internal {

        string memory labelKey = uintArray3ToString(version.label);

        require(
            set.versions[labelKey].urls.length == 0,
            "#Versions: A version with that label already exists"
        );

        // add to labels array
        set.labels.push(labelKey);

        // store urls and hashes in mapping
        for (uint256 i = 0; i < version.urls.length; i++){
            set.versions[labelKey].urls.push(version.urls[i]);
        }

        // store label
        set.versions[labelKey].label = version.label;
    }

    function getVersion(
        Set storage set,
        uint8[3] memory label
    )
        internal
        view
        returns (Version memory)
    {
        Version memory version = set.versions[uintArray3ToString(label)];
        require(
            version.urls.length != 0,
            "#Versions: The version does not exist"
        );
        return version;
    }

    // NOTE: only update url is possible and should result in same hash
    // NOTE: index must be known updating url
    function updateVersionURL(
        Set storage set,
        uint8[3] memory label,
        uint256 index,
        string memory newUrl
    ) internal {
        string memory labelKey = uintArray3ToString(label);
        require(
            set.versions[labelKey].urls.length != 0,
            "#Versions: The version does not exist"
        );
        require(
            set.versions[labelKey].urls.length > index,
            "#Versions: The url does not exist on that version"
        );
        set.versions[labelKey].urls[index].url = newUrl;
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
        require(_labels.length != 0, "#Versions: No labels provided");
        Version[] memory versionArray = new Version[](_labels.length);

        for (uint256 i = 0; i < _labels.length; i++) {
                versionArray[i] = set.versions[_labels[i]];
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
        require(
            set.labels.length != 0,
            "#Versions: No versions exist"
        );
        return set.versions[
            set.labels[set.labels.length - 1]
        ];
    }

    function uintArray3ToString (uint8[3] memory label)
        internal
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