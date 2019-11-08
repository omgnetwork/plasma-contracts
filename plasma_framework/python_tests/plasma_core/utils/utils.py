from eth_utils import decode_hex


def normalize_key(key):
    if isinstance(key, bytes):
        key = key.decode("utf-8")
    if isinstance(key, int):
        o = encode_int32(key)
    elif len(key) == 32:
        o = key
    elif len(key) == 64:
        o = decode_hex(key)
    elif len(key) == 66 and key[:2] == '0x':
        o = decode_hex(key[2:])
    else:
        raise Exception("Invalid key format: %r" % key)
    if o == b'\x00' * 32:
        raise Exception("Zero privkey invalid")
    return o


def hex_to_binary(h):
    assert isinstance(h, str)
    if h[:2] == '0x':
        h = h[2:]
    return bytes.fromhex(h)


def decode_int32(v):
    return int.from_bytes(v, byteorder='big')


def encode_int32(v):
    return v.to_bytes(32, byteorder='big')
