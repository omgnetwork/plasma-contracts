from plasma_core.plasma.constants import BLOCK_OFFSET, TX_OFFSET


def encode_output_id(blknum, txindex, oindex):
    return blknum * BLOCK_OFFSET + txindex * TX_OFFSET + oindex


def decode_output_id(output_id):
    blknum = output_id // BLOCK_OFFSET
    txindex = (output_id % BLOCK_OFFSET) // TX_OFFSET
    oindex = output_id % TX_OFFSET
    return (blknum, txindex, oindex)


def decode_tx_id(output_id):
    (blknum, txindex, _) = decode_output_id(output_id)
    return encode_output_id(blknum, txindex, 0)
