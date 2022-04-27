// SPDX-License-Identifier: GPL-3.0

/**

█▄░█ █▀▀ ▀█▀   █▀▀ █▀▄ █ ▀█▀ █ █▀█ █▄░█ █▀
█░▀█ █▀░ ░█░   ██▄ █▄▀ █ ░█░ █ █▄█ █░▀█ ▄█

▀█ █▀█ █▀█ ▄▀█
█▄ █▄█ █▀▄ █▀█

 */

pragma solidity ^0.8.6;

import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {Versions} from "./Versions.sol";
import "./SingleEditionMintable.sol";
import "./SeededSingleEditionMintable.sol";

contract SingleEditionMintableCreator {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    enum Implementation {
        editions,
        seededEditions
    }

    /// Important: None of these fields can be changed after calling
    /// urls can be updated and upgraded via the versions interface
    struct EditionData {
        string name; // Name of the edition contract
        string symbol; // Symbol of the edition contract
        string description; /// Metadata: Description of the edition entry
        Versions.Version version; /// Version media with animation url, animation sha256hash, image url, image sha256hash
        uint256 editionSize; /// Total size of the edition (number of possible editions)
        uint256 royaltyBPS; /// BPS amount of royalty
    }

    /// Counter for current contract id upgraded
    CountersUpgradeable.Counter[2] private atContracts;

    /// Address for implementation of SingleEditionMintable to clone
    address[2] public implementations;

    /// Initializes factory with address of implementations logic
    /// @param _implementations Array of addresse for implementations of SingleEditionMintable like contracts to clone
    constructor(address[] memory _implementations) {
        implementations[uint8(Implementation.editions)] = _implementations[uint8(Implementation.editions)];
        implementations[uint8(Implementation.seededEditions)] = _implementations[uint8(Implementation.editions)];
    }

    /// Creates a new edition contract as a factory with a deterministic address
    /// @param editionData EditionData of the edition contract
    /// @param implementation Implementation of the edition contract

    function createEdition(
        EditionData memory editionData,
        uint8 implementation
    ) external returns (uint256) {
        uint256 newId = atContracts[implementation].current();
        address newContract = ClonesUpgradeable.cloneDeterministic(
            implementations[implementation],
            bytes32(abi.encodePacked(newId))
        );

        // Editions
        if (implementation == uint8(Implementation.editions)){
            SingleEditionMintable(newContract).initialize(
                msg.sender,
                editionData.name,
                editionData.symbol,
                editionData.description,
                editionData.version,
                editionData.editionSize,
                editionData.royaltyBPS
            );
        }

        // Seeded Editions
        if (implementation == uint8(Implementation.seededEditions)){
            SeededSingleEditionMintable(newContract).initialize(
                msg.sender,
                editionData.name,
                editionData.symbol,
                editionData.description,
                editionData.version,
                editionData.editionSize,
                editionData.royaltyBPS
            );
        }

        emit CreatedEdition(newId, msg.sender, editionData.editionSize, newContract, implementation);
        // Returns the ID of the recently created minting contract
        // Also increments for the next contract creation call
        atContracts[implementation].increment();
        return newId;
    }

    /// Get edition given the created ID
    /// @param editionId id of edition to get contract for
    /// @return SingleEditionMintable Edition NFT contract
    function getEditionAtId(uint256 editionId, uint8 implementation)
        external
        view
        returns (address)
    {
        return
            ClonesUpgradeable.predictDeterministicAddress(
                implementations[implementation],
                bytes32(abi.encodePacked(editionId)),
                address(this)
            );
    }

    /// Emitted when a edition is created reserving the corresponding token IDs.
    /// @param editionId ID of newly created edition
    event CreatedEdition(
        uint256 indexed editionId,
        address indexed creator,
        uint256 editionSize,
        address editionContractAddress,
        uint8 implementation
    );
}
