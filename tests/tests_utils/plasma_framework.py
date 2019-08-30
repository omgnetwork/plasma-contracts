from .constants import EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES, INITIAL_IMMUNE_VAULTS


class PlasmaFramework:
    def __init__(self, get_contract, maintainer):
        self.plasma_framework = get_contract('PlasmaFramework',
                                             args=(EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES),
                                             sender=maintainer)

        self.plasma_framework.initAuthority()  # initialised by default web3 account

        # deposit verifiers
        self.eth_deposit_verifier = get_contract('EthDepositVerifier', sender=maintainer)
        self.erc20_deposit_verifier = get_contract('Erc20DepositVerifier', sender=maintainer)

        # vaults setup
        self.eth_vault = get_contract('EthVault', args=(self.plasma_framework.address,), sender=maintainer)
        self.erc20_vault = get_contract('Erc20Vault', args=(self.plasma_framework.address,), sender=maintainer)

        self.eth_vault.setDepositVerifier(self.eth_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(1, self.eth_vault.address, **{"from": maintainer.address})

        self.erc20_vault.setDepositVerifier(self.erc20_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(2, self.erc20_vault.address, **{"from": maintainer.address})

    def blocks(self, block):
        return self.plasma_framework.blocks(block)

    def addToken(self, token):
        raise NotImplementedError

    def submitBlock(self, block_root, **kwargs):
        self.plasma_framework.submitBlock(block_root, **kwargs)

    def deposit(self, deposit_tx, **kwargs):
        return self.eth_vault.deposit(deposit_tx, **kwargs)

    def depositFrom(self, deposit_tx, **kwargs):
        return self.erc20_vault.deposit(deposit_tx, **kwargs)

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
        return self.plasma_framework.nextChildBlock()

    def nextDepositBlock(self):
        return self.plasma_framework.nextDepositBlock()

    def childBlockInterval(self):
        return self.plasma_framework.childBlockInterval()
