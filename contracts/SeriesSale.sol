// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./ISerialSingleMintable.sol";
import "./FundsRecoverable.sol";

contract SeriesSale is ReentrancyGuardUpgradeable, FundsRecoverable {
    event OnPauseChange(uint256 releaseId, bool pauseStatus);
    event OnNewRelease(uint256 releaseId);

    struct SketchRelease {
        bool isPaused;
        uint256 maxAllowed;
        uint256 currentReleased;
        uint256 ethPrice;
        address payable recipient;
        address mintableAddress;
        uint256 mintableCollection;
    }

    SketchRelease[] private releases;

    function createRelease(
        bool isPaused,
        uint256 maxAllowed,
        uint256 ethPrice,
        address payable recipient,
        address mintableAddress,
        uint256 mintableCollection
    ) public onlyOwner {
        SketchRelease memory sketchRelease;
        sketchRelease.isPaused = isPaused;
        sketchRelease.maxAllowed = maxAllowed;
        sketchRelease.recipient = recipient;
        sketchRelease.ethPrice = ethPrice;
        sketchRelease.mintableAddress = mintableAddress;
        sketchRelease.mintableCollection = mintableCollection;

        emit OnNewRelease(releases.length);
        releases.push(sketchRelease);
    }

    function setPaused(uint256 releaseId, bool isPaused) public onlyOwner {
        releases[releaseId].isPaused = isPaused;
        emit OnPauseChange(releaseId, isPaused);
    }

    function getRelease(uint256 releaseId)
        public
        view
        returns (SketchRelease memory)
    {
        return releases[releaseId];
    }

    function mint(uint256 releaseId)
        public
        payable
        nonReentrant
        returns (uint256)
    {
        SketchRelease memory release = getRelease(releaseId);
        require(release.currentReleased < release.maxAllowed, "FINISHED");
        require(!release.isPaused, "PAUSED");

        if (release.ethPrice > 0) {
            require(release.ethPrice == msg.value, "PRICE");
            (bool sent, ) = release.recipient.call{
                value: msg.value,
                gas: 30_000
            }("");
            require(sent, "Failed to send Ether");
        }

        releases[releaseId].currentReleased += 1;
        uint256 mintedToken = ISerialSingleMintable(release.mintableAddress)
            .mintSerial(msg.sender);

        return mintedToken;
    }
}