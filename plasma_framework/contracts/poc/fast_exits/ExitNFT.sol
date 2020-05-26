pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";

contract ExitNFT is ERC721Full {

    mapping(uint160 => uint256) public exitIdtoAmount;

    constructor () ERC721Full("OMG Exit","OMGE") public {

    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }
    // a token swap could go right here
}