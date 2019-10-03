def test_exit_queue_adding_gas_cost(w3, plasma_framework):
    ADDRESS_A = b'\x00' * 19 + b'\x01'
    ADDRESS_B = b'\x00' * 19 + b'\x02'
    tx_hash = plasma_framework.addExitQueue(plasma_framework.erc20_vault_id, ADDRESS_A)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue first deployment costs {} gas".format(gas))
    tx_hash = plasma_framework.addExitQueue(plasma_framework.erc20_vault_id, ADDRESS_B)
    gas = w3.eth.getTransactionReceipt(tx_hash).gasUsed
    print("PriorityQueue second deployment costs {} gas".format(gas))
