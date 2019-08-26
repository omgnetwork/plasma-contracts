from plasma_core.constants import CHILD_BLOCK_INTERVAL
from .constants import EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES, INITIAL_IMMUNE_VAULTS


class PlasmaFramework:
    def __init__(self, get_contract):
        self.plasma_framework = get_contract('PlasmaFramework',
                                             args=(EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES))

        self.blockController = get_contract('BlockController',
                                            args=(CHILD_BLOCK_INTERVAL, EXIT_PERIOD, INITIAL_IMMUNE_VAULTS))

    def blocks(self, block):
        return self.blockController.blocks(block)

    def addToken(self, token):
        raise NotImplementedError

    def submitBlock(self, block_root, **kwargs):
        self.blockController.submitBlock(block_root, **kwargs)

    def deposit(self, deposit_tx):
        raise NotImplementedError

    def depositFrom(self, deposit_tx):
        raise NotImplementedError

    def startStandardExit(self, utxo_pos, output_tx, output_tx_inclusion_proof):
        raise NotImplementedError

    def challengeStandardExit(self, standard_exit_id, challenge_tx, input_index, challenge_tx_sig):
        raise NotImplementedError

    def startFeeExit(self, token, amount):
        raise NotImplementedError

    def startInFlightExit(self, in_flight_tx, input_txs, input_txs_inclusion_proofs, in_flight_tx_sigs):
        raise NotImplementedError

    def piggybackInFlightExit(self, in_flight_tx, output_index):
        raise NotImplementedError

    def challengeInFlightExitNotCanonical(self, in_flight_tx,
                                          in_flight_tx_input_index,
                                          competing_tx,
                                          competing_tx_input_index,
                                          competing_tx_pos,
                                          competing_tx_inclusion_proof,
                                          competing_tx_sig):
        raise NotImplementedError

    def respondToNonCanonicalChallenge(self, in_flight_tx, in_flight_tx_pos, in_flight_tx_inclusion_proof):
        raise NotImplementedError

    def challengeInFlightExitInputSpent(self, in_flight_tx,
                                        in_flight_tx_input_index,
                                        spending_tx,
                                        spending_tx_input_index,
                                        spending_tx_sig):
        raise NotImplementedError

    def challengeInFlightExitOutputSpent(self, in_flight_tx,
                                         in_flight_tx_output_pos,
                                         in_flight_tx_inclusion_proof,
                                         spending_tx,
                                         spending_tx_input_index,
                                         spending_tx_sig):
        raise NotImplementedError

    def processExits(self, token, top_exit_id, exits_to_process):
        raise NotImplementedError

    def getInFlightExitId(self, tx):
        raise NotImplementedError

    def getStandardExitId(self, tx_bytes, utxo_pos):
        raise NotImplementedError

    def getFeeExitId(self, fee_exit_num):
        raise NotImplementedError

    def getNextExit(self, token):
        raise NotImplementedError

    def unpackExitId(self, priority):
        raise NotImplementedError

    def hasToken(self, token):
        raise NotImplementedError

    def getInFlightExitOutput(self, tx, output_index):
        raise NotImplementedError

    def nextChildBlock(self):
        return self.blockController.nextChildBlock()

    def getDepositBlockNumber(self):
        return self.blockController.nextDepositBlock()
