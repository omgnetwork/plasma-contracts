import pytest
from eth_utils import to_normalized_address, to_checksum_address, to_canonical_address

from plasma_core.constants import NULL_ADDRESS
from eth_tester.exceptions import TransactionFailed
from plasma_core.transaction import Transaction
from plasma_core.utils.transactions import decode_utxo_id


@pytest.fixture
def plasma_core_test(get_contract):
    contract = get_contract('PlasmaCoreTest')
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
    owner = '0x82a978b3f5962a5b0957d9ee9eef472ee55b42f1'
    amount = 100
    tx = Transaction(outputs=[(owner, null, amount)])
    assert plasma_core_test.getOutput(tx.encoded, 0) == [to_checksum_address(owner), null, amount]
    assert plasma_core_test.getOutput(tx.encoded, 1) == [null, null, 0]


def test_decode_mallability(testlang, plasma_core_test):
    owner, amount = testlang.accounts[0], 100
    null = '0x0000000000000000000000000000000000000000'
    tx = Transaction(outputs=[(owner.address, null, amount)], metadata="")
    import rlp
    encoded_with_extra_field = rlp.encode([tx.inputs, tx.outputs, tx.metadata, 0])

    with pytest.raises(TransactionFailed):
        plasma_core_test.getOutput(encoded_with_extra_field, 0)


def test_metadata_is_part_of_the_proof(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    input_ids = [deposit_id]
    outputs = [(owner.address, NULL_ADDRESS, amount)]
    spend_id = testlang.spend_utxo(input_ids, [owner], outputs, b'metadata info')

    inputs = [decode_utxo_id(input_id) for input_id in input_ids]
    bad_spend_tx = Transaction(inputs=inputs, outputs=outputs, metadata=b'other information')
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit_with_tx_body(spend_id, bad_spend_tx, owner)


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


def test_decoding_tx_with_gaps_in_inputs_fails(testlang, plasma_core_test):
    owner, amount = testlang.accounts[0], 100
    tx = Transaction(inputs=[(0, 0, 0), (1, 0, 0)], outputs=[(owner.address, NULL_ADDRESS, amount)])
    with pytest.raises(TransactionFailed):
        plasma_core_test.getInputUtxoPosition(tx.encoded, 0)

    tx = Transaction(inputs=[(1, 0, 0), (0, 0, 0), (1, 1, 0)], outputs=[(owner.address, NULL_ADDRESS, amount)])
    with pytest.raises(TransactionFailed):
        plasma_core_test.getInputUtxoPosition(tx.encoded, 1)


def test_decoding_tx_with_gaps_in_outputs_fails(testlang, plasma_core_test):
    owner, amount = testlang.accounts[0], 100
    null_output = (NULL_ADDRESS, NULL_ADDRESS, 0)

    tx = Transaction(inputs=[(1, 0, 0)], outputs=[null_output, (owner.address, NULL_ADDRESS, amount)])
    with pytest.raises(TransactionFailed):
        plasma_core_test.getOutput(tx.encoded, 0)

    tx = Transaction(
        inputs=[(1, 0, 0)],
        outputs=[(owner.address, NULL_ADDRESS, amount), null_output, (owner.address, NULL_ADDRESS, amount)])
    with pytest.raises(TransactionFailed):
        plasma_core_test.getOutput(tx.encoded, 1)


def test_deposit_tx_is_successfully_decoded(testlang, plasma_core_test):
    owner, amount = testlang.accounts[0], 100
    tx = Transaction(inputs=[], outputs=[(owner.address, NULL_ADDRESS, amount)])
    assert plasma_core_test.getInputUtxoPosition(tx.encoded, 0) == 0
