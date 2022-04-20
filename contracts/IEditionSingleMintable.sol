// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.6;

struct MintData {
  address to;
  uint256 seed;
}

interface IEditionSingleMintable {
  function mintEdition(address to) external returns (uint256);
  function mintEditionWithSeed(address to, uint256 seed) external returns (uint256);
  function mintEditions(address[] memory to) external returns (uint256);
  function mintEditionsWithSeed(MintData[] memory to) external returns (uint256);
  function numberCanMint() external view returns (uint256);
  function owner() external view returns (address);
}