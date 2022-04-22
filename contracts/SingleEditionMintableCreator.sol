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

    /// Counter for current contract id upgraded
    CountersUpgradeable.Counter[2] private atContracts;

    /// Address for implementation of SingleEditionMintable to clone
    address[2] public implementations;

    /// Initializes factory with address of implementations logic
    /// @param _editionsImplementation SingleEditionMintable logic implementation contract to clone
    /// @param _seededEditionsImplementation SeededSingleEditionMintable logic implementation contract to clone
    constructor(address _editionsImplementation, address _seededEditionsImplementation) {
        implementations[uint8(Implementation.editions)] = _editionsImplementation;
        implementations[uint8(Implementation.seededEditions)] = _seededEditionsImplementation;
    }

    /// Creates a new edition contract as a factory with a deterministic address
    /// Important: None of these fields (except the Url fields with the same hash) can be changed after calling
    /// @param _name Name of the edition contract
    /// @param _symbol Symbol of the edition contract
    /// @param _description Metadata: Description of the edition entry
    /// @param _version Version media with animation url, animation sha256hash, image url, image sha256hash
    /// @param _editionSize Total size of the edition (number of possible editions)
    /// @param _royaltyBPS BPS amount of royalty
    function createEdition(
        string memory _name,
        string memory _symbol,
        string memory _description,
        Versions.Version memory _version,
        uint256 _editionSize,
        uint256 _royaltyBPS
    ) external returns (uint256) {
        uint256 newId = atContracts[uint8(Implementation.editions)].current();
        address newContract = ClonesUpgradeable.cloneDeterministic(
            implementations[uint8(Implementation.editions)],
            bytes32(abi.encodePacked(newId))
        );
        SingleEditionMintable(newContract).initialize(
            msg.sender,
            _name,
            _symbol,
            _description,
            _version,
            _editionSize,
            _royaltyBPS
        );
        emit CreatedEdition(newId, msg.sender, _editionSize, newContract);
        // Returns the ID of the recently created minting contract
        // Also increments for the next contract creation call
        atContracts[uint8(Implementation.editions)].increment();
        return newId;
    }

    /// Get edition given the created ID
    /// @param editionId id of edition to get contract for
    /// @return SingleEditionMintable Edition NFT contract
    function getEditionAtId(uint256 editionId)
        external
        view
        returns (SingleEditionMintable)
    {
        return
            SingleEditionMintable(
                ClonesUpgradeable.predictDeterministicAddress(
                    implementations[uint8(Implementation.editions)],
                    bytes32(abi.encodePacked(editionId)),
                    address(this)
                )
            );
    }

    /// Emitted when a edition is created reserving the corresponding token IDs.
    /// @param editionId ID of newly created edition
    event CreatedEdition(
        uint256 indexed editionId,
        address indexed creator,
        uint256 editionSize,
        address editionContractAddress
    );

     /// Creates a new edition contract as a factory with a deterministic address
    /// Important: None of these fields (except the Url fields with the same hash) can be changed after calling
    /// @param _name Name of the edition contract
    /// @param _symbol Symbol of the edition contract
    /// @param _description Metadata: Description of the edition entry
    /// @param _version Version media with animation url, animation sha256hash, image url, image sha256hash
    /// @param _editionSize Total size of the edition (number of possible editions)
    /// @param _royaltyBPS BPS amount of royalty
    function createSeededEdition(
        string memory _name,
        string memory _symbol,
        string memory _description,
        Versions.Version memory _version,
        uint256 _editionSize,
        uint256 _royaltyBPS
    ) external returns (uint256) {
        uint256 newId = atContracts[uint8(Implementation.seededEditions)].current();
        address newContract = ClonesUpgradeable.cloneDeterministic(
            implementations[uint8(Implementation.seededEditions)],
            bytes32(abi.encodePacked(newId))
        );
        SeededSingleEditionMintable(newContract).initialize(
            msg.sender,
            _name,
            _symbol,
            _description,
            _version,
            _editionSize,
            _royaltyBPS
        );
        emit CreatedSeededEdition(newId, msg.sender, _editionSize, newContract);
        // Returns the ID of the recently created minting contract
        // Also increments for the next contract creation call
        atContracts[uint8(Implementation.seededEditions)].increment();
        return newId;
    }

    /// Get edition given the created ID
    /// @param editionId id of edition to get contract for
    /// @return SeededSingleEditionMintable Edition NFT contract
    function getSeededEditionAtId(uint256 editionId)
        external
        view
        returns (SeededSingleEditionMintable)
    {
        return
            SeededSingleEditionMintable(
                ClonesUpgradeable.predictDeterministicAddress(
                    implementations[uint8(Implementation.seededEditions)],
                    bytes32(abi.encodePacked(editionId)),
                    address(this)
                )
            );
    }

    /// Emitted when a edition is created reserving the corresponding token IDs.
    /// @param editionId ID of newly created edition
    event CreatedSeededEdition(
        uint256 indexed editionId,
        address indexed creator,
        uint256 editionSize,
        address editionContractAddress
    );
}
