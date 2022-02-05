import {utils} from "ethers"

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