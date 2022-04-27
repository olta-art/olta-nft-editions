import {utils , BigNumberish} from "ethers"
import {URL} from "url"
export const getSeed = (tokenId: number, tokenAddress: string) => {
  const hash = utils.keccak256(
    utils.concat([
      utils.hexZeroPad(utils.hexlify(tokenId), 32),
      utils.hexZeroPad(utils.hexlify(tokenAddress), 20)
    ])
  )
  const bytes8 = utils.hexDataSlice(hash,0, 8)
  const base64 = utils.base64.encode(bytes8)
  return base64
}

export const parseUrlQuery = (url: string) => {
  const theURL = new URL(url)

  const id = theURL.searchParams.get("id")
  const seed = theURL.searchParams.get("seed")
  const address = theURL.searchParams.get("address")

  return {
    id,
    seed,
    address
  }
}

export enum Implementation {
  editions,
  seededEditions
}

export interface Version {
  urls: {
    url: string;
    sha256hash: string;
  }[];
  label: Label;
}

export type Label = [BigNumberish, BigNumberish, BigNumberish]

export const editionData = (
  name: string,
  symbol: string,
  description: string,
  version: Version,
  editionSize: BigNumberish,
  royaltyBPS: BigNumberish
) => ({
  name,
  symbol,
  description,
  version,
  editionSize,
  royaltyBPS
})