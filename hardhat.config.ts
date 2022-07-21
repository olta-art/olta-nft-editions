// @ts-nocheck
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import "./tasks/generate-docs";
import { HardhatUserConfig } from "hardhat/config";
import networks from './networks';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Go to https://hardhat.org/config/ to learn more
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "mumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://api-testnet.polygonscan.com",
          browserURL: "https://mumbai.polygonscan.com"
        }
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com",
          browserURL: "https://polygonscan.com"
        }
      }
    ]
  },
  gasReporter: {
    currency: 'GBP',
    gasPrice: 120,
    coinmarketcap: process.env.COINMARKETCAP_KEY,
  },
  networks,
  namedAccounts: {
    deployer: 0,
    purchaser: 0,
  },
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
};

export default config;

