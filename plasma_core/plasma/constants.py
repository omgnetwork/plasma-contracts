from ethereum.utils import sha3
from plasma_core.plasma.utils.address import address_to_hex


NULL_BYTE = b'\x00'
NULL_SIGNATURE = NULL_BYTE * 65
NULL_ADDRESS = NULL_BYTE * 20
NULL_ADDRESS_HEX = address_to_hex(NULL_ADDRESS)
NULL_HASH = sha3(NULL_BYTE * 32)

BLOCK_OFFSET = 1000000000
TX_OFFSET = 10000

WEEKS = 60 * 60 * 24 * 7
