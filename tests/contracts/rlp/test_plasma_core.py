import pytest
from ethereum.tools.tester import TransactionFailed
from plasma_core.transaction import Transaction


@pytest.fixture
def plasma_core_test(ethtester, get_contract):
    contract = get_contract('PlasmaCoreTest')
    ethtester.chain.mine()
    return contract


def test_slice_proof(plasma_core_test):
    proof = b'\x00' * 1023 + b'\x01'
    assert plasma_core_test.sliceProof(proof, 0) == proof[0:512]
    assert plasma_core_test.sliceProof(proof, 1) == proof[512:1024]


def test_slice_signature(plasma_core_test):
    signatures = b'\x00' * 129 + b'\x01'
    assert plasma_core_test.sliceSignature(signatures, 0) == signatures[0:65]
    assert plasma_core_test.sliceSignature(signatures, 1) == signatures[65:130]


def test_get_output(plasma_core_test):
    null = '0x0000000000000000000000000000000000000000'
    owner = b'0x82a978b3f5962a5b0957d9ee9eef472ee55b42f1'
    amount = 100
    tx = Transaction(outputs=[(owner, null, amount)])
    assert plasma_core_test.getOutput(tx.encoded, 0) == [owner.decode("utf-8"), null, amount]
    assert plasma_core_test.getOutput(tx.encoded, 1) == [null, null, 0]


def test_decode_mallability(testlang, plasma_core_test):
    owner, amount = testlang.accounts[0], 100
    null = '0x0000000000000000000000000000000000000000'
    tx = Transaction(outputs=[(owner.address, null, amount)])
    tx.sign(0, owner.key)
    import rlp
    encoded_with_signatures = rlp.encode(tx, Transaction)

    with pytest.raises(TransactionFailed):
        plasma_core_test.getOutput(encoded_with_signatures, 0)


def test_get_input_id(plasma_core_test):
    input_id = (2, 2, 2)
    tx = Transaction(inputs=[input_id])
    assert plasma_core_test.getInputUtxoPosition(tx.encoded, 0) == tx.inputs[0].identifier
    assert plasma_core_test.getInputUtxoPosition(tx.encoded, 1) == 0
    assert plasma_core_test.getInputUtxoPosition(tx.encoded, 2) == 0
    assert plasma_core_test.getInputUtxoPosition(tx.encoded, 3) == 0


def test_get_output_index(plasma_core_test):
    output_id = 1000020003
    assert plasma_core_test.getOindex(output_id) == 3


def test_get_tx_index(plasma_core_test):
    output_id = 1000020003
    assert plasma_core_test.getTxIndex(output_id) == 2


def test_get_blknum(plasma_core_test):
    output_id = 1000020003
    assert plasma_core_test.getBlknum(output_id) == 1


def test_get_txpos_index(plasma_core_test):
    output_id = 1000020003
    assert plasma_core_test.getTxPos(output_id) == 100002
