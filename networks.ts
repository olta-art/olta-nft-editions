import { NetworksUserConfig } from "hardhat/types";
import dotenv from 'dotenv';

// Setup env from .env file if presetn
dotenv.config();

const networks: NetworksUserConfig = {};

if (process.env.DEV_MNEMONIC) {
  networks.mumbai = {
    chainId: 80001,
    url: "https://rpc-mumbai.maticvigil.com",
    accounts: [`0x${process.env.DEV_MNEMONIC}`],
    // Gas price needed because no estimation
    // gasPrice: 30000000000,
    gasPrice: 34833375662
  };
  networks.polygon = {
    chainId: 137,
    url: "https://polygon-rpc.com/",
    accounts: [`0x${process.env.POL_MNEMONIC}`],
    gasPrice: 80000000000,
  }
}

export default networks;
