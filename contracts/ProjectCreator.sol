// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.6;

import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Versions} from "./Versions.sol";

interface IProject {
    function initialize(
        address _owner,
        string memory _name,
        string memory _symbol,
        string memory _description,
        Versions.Version memory _version,
        uint256 _editionSize,
        uint256 _royaltyBPS
    ) external;
}

contract ProjectCreator is Initializable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /// Important: None of these fields can be changed after calling
    /// urls can be updated and upgraded via the versions interface
    struct ProjectData {
        string name; // Name of the edition contract
        string symbol; // Symbol of the edition contract
        string description; /// Metadata: Description of the edition entry
        Versions.Version version; /// Version media with animation url, animation sha256hash, image url, image sha256hash
        uint256 editionSize; /// Total size of the edition (number of possible editions)
        uint256 royaltyBPS; /// BPS amount of royalty
    }

    struct creatorApproval {
        address id;
        bool approval;
    }

    modifier onlyCreator {
        require(creatorApprovals[address(0)] || creatorApprovals[msg.sender], "Only approved creators can call this function.");
        _;
    }

    mapping(address => bool) private creatorApprovals;

    /// Counter for current contract id upgraded
    mapping(uint8 => CountersUpgradeable.Counter) private atContracts;

    /// Address for implementation of SingleEditionMintable to clone
    address[] public implementations;

    /// Initializes factory with address of implementations logic
    /// @param _implementations Array of addresse for implementations of SingleEditionMintable like contracts to clone
    function initialize(address[] memory _implementations) public initializer {
        for (uint8 i = 0; i < _implementations.length; i++) {
            implementations.push(_implementations[i]);
            atContracts[i] = CountersUpgradeable.Counter(0);
        }

        // initilize ownable
        __Ownable_init();

        // set creator approval for owner
        creatorApprovals[address(msg.sender)] = true;
    }

    /// Creates a new edition contract as a factory with a deterministic address
    /// @param projectData the data of the of the project being created
    /// @param implementation Implementation of the project contract
    function createProject(
        ProjectData memory projectData,
        uint8 implementation
    )
        external
        onlyCreator
        returns (uint256)
    {
        require(implementations.length > implementation, "implementation does not exist");

        uint256 newId = atContracts[implementation].current();
        address newContract = ClonesUpgradeable.cloneDeterministic(
            implementations[implementation],
            bytes32(abi.encodePacked(newId))
        );

        IProject(newContract).initialize(
            msg.sender,
            projectData.name,
            projectData.symbol,
            projectData.description,
            projectData.version,
            projectData.editionSize,
            projectData.royaltyBPS
        );

        emit CreatedProject(
            newId,
            msg.sender,
            projectData.editionSize,
            newContract,
            implementation
        );

        // increment for the next contract creation call
        atContracts[implementation].increment();

        return newId;
    }

    /// Get project given the created ID
    /// @param projectId id of the project to get
    /// @return project the contract of the project
    function getProjectAtId(uint256 projectId, uint8 implementation)
        external
        view
        returns (address)
    {
        return
            ClonesUpgradeable.predictDeterministicAddress(
                implementations[implementation],
                bytes32(abi.encodePacked(projectId)),
                address(this)
            );
    }

    function addImplementation(address implementation)
        external
        onlyOwner
        returns (uint256)
    {
        // initilize counter for implementation
        atContracts[uint8(implementations.length)] = CountersUpgradeable.Counter(0);
        // add implementation to clonable implementations
        implementations.push(implementation);

        emit ImplemnetationAdded(
            implementation,
            uint8(implementations.length - 1)
        );

        return implementations.length;
    }

    function setCreatorApprovals(creatorApproval[] memory creators)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < creators.length; i++) {
            creatorApprovals[creators[i].id] = creators[i].approval;
        }

        emit CreatorApprovalsUpdated(creators);
    }

    event CreatorApprovalsUpdated (
        creatorApproval[] creators
    );

    event ImplemnetationAdded(
        address indexed implementationContractAddress,
        uint8 implementation
    );

    /// Emitted when a project is created reserving the corresponding token IDs.
    /// @param projectId ID of newly created edition
    event CreatedProject(
        uint256 indexed projectId,
        address indexed creator,
        uint256 editionSize,
        address project,
        uint8 implementation
    );
}
