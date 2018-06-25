from ethereum import utils
from plasma_core.plasma.constants import NULL_SIGNATURE


def sign(data, key):
    vrs = utils.ecsign(data, key)
    rsv = vrs[1:] + vrs[:1]
    s_bytes = [utils.int_to_bytes(rsv[2])]
    vrs_bytes = [utils.encode_int32(i) for i in rsv[:2]] + s_bytes
    return b''.join(vrs_bytes)


def get_signer(data, signature):
    v = signature[64]
    if v < 27:
        v += 27
    r = utils.bytes_to_int(signature[:32])
    s = utils.bytes_to_int(signature[32:64])
    pub = utils.ecrecover_to_pub(data, v, r, s)
    return utils.sha3(pub)[-20:]


def get_null_sig_list(length):
    return ([NULL_SIGNATURE] * length)[:]
