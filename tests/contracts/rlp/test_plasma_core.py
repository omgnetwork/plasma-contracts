import pytest
from plasma_core.constants import NULL_ADDRESS
from ethereum.tools.tester import TransactionFailed
from plasma_core.transaction import Transaction
from plasma_core.utils.transactions import decode_utxo_id


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
    tx = Transaction(outputs=[(owner.address, null, amount)], metadata="")
    import rlp
    encoded_with_extra_field = rlp.encode([tx.inputs, tx.outputs, tx.metadata, 0])

    with pytest.raises(TransactionFailed):
        plasma_core_test.getOutput(encoded_with_extra_field, 0)


def test_metadata_is_part_of_the_proof(testlang):
    owner, amount = testlang.accounts[0], 100
    deposit_id = testlang.deposit(owner, amount)

    input_ids = [deposit_id]
    keys = [owner.key]
    outputs = [(owner.address, NULL_ADDRESS, amount)]
    spend_id = testlang.spend_utxo(input_ids, keys, outputs, "metadata info")

    inputs = [decode_utxo_id(input_id) for input_id in input_ids]
    bad_spend_tx = Transaction(inputs=inputs, outputs=outputs, metadata="other information")
    with pytest.raises(TransactionFailed):
        testlang.start_standard_exit_with_tx_body(spend_id, bad_spend_tx, owner.key)


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

# def test_deploy(get_contract):
#     pqf = get_contract('PlasmaCoreTest')
#     assert pqf.address == 0

# def test_returned_domain_separator(testlang, plasma_core_test):
#     o1 = ('0x2258a5279850f6fb78888a7e45ea2a5eb1b3c436', NULL_ADDRESS, 100)
#     o2 = ('0x0123456789abcdef000000000000000000000000', NULL_ADDRESS, 111)
#     o3 = ('0x2258a5279850f6fb78888a7e45ea2a5eb1b3c436', '0x0123456789abcdef000000000000000000000000', 1337)  
#     mt = bytes.fromhex('853a8d8af99c93405a791b97d57e819e538b06ffaa32ad70da2582500bc18d43')
    
#     tx1 = Transaction(inputs=[], outputs=[])
#     tx2 = Transaction(inputs=[(1, 0, 0), (1000, 2, 3), (101000, 1337, 3)], outputs=[o1, o2, o3])
#     tx3 = Transaction(inputs=[(1, 0, 0), (1000, 2, 3), (101000, 1337, 3)], outputs=[o1, o2, o3], metadata=mt)

#     owner = '0x2258a5279850f6fb78888a7e45ea2a5eb1b3c436'
#     sign = bytes.fromhex('f4a9fa3c09bbef23fc26f4a1a871b6f5f04a51b9d73a07096ffb8c08880d23112bcfc7748673121708d60a8efbeb15362582d8dd9c21d336c1be47763edd5ed11c')

#     assert plasma_core_test.getDomainSep(tx3.encoded, sign) == 1
    