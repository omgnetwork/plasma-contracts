import enum

from plasma_core.constants import CHILD_BLOCK_INTERVAL
from plasma_core.transaction import TxOutputTypes, TxTypes
from plasma_core.utils.transactions import decode_utxo_id
from .constants import EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES, INITIAL_IMMUNE_VAULTS


class Protocols(enum.Enum):
    MVP = 1
    MoreVP = 2


class PlasmaFramework:
    def __init__(self, get_contract, maintainer):
        self.plasma_framework = get_contract('PlasmaFramework',
                                             args=(EXIT_PERIOD, INITIAL_IMMUNE_VAULTS, INITIAL_IMMUNE_EXIT_GAMES),
                                             sender=maintainer)

        self.plasma_framework.initAuthority()  # initialised by default web3 account

        self._setup_deposit_verifiers(get_contract, maintainer)
        self._setup_vaults(get_contract, maintainer)
        self._setup_output_guards(get_contract, maintainer)
        self._setup_spending_conditions(get_contract, maintainer)
        self._setup_exit_games(get_contract, maintainer)

    def _setup_deposit_verifiers(self, get_contract, maintainer):
        self.eth_deposit_verifier = get_contract('EthDepositVerifier', sender=maintainer)
        self.erc20_deposit_verifier = get_contract('Erc20DepositVerifier', sender=maintainer)

    def _setup_vaults(self, get_contract, maintainer):
        self.eth_vault = get_contract('EthVault', args=(self.plasma_framework.address,), sender=maintainer)
        self.erc20_vault = get_contract('Erc20Vault', args=(self.plasma_framework.address,), sender=maintainer)

        self.eth_vault.setDepositVerifier(self.eth_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(1, self.eth_vault.address, **{"from": maintainer.address})

        self.erc20_vault.setDepositVerifier(self.erc20_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(2, self.erc20_vault.address, **{"from": maintainer.address})

    def _setup_spending_conditions(self, get_contract, maintainer):
        self.payment_spending_condition_registry = get_contract("PaymentSpendingConditionRegistry", sender=maintainer)

    def _setup_output_guards(self, get_contract, maintainer):
        self.output_guard_registry = get_contract("OutputGuardHandlerRegistry", sender=maintainer)

        self.payment_output_guard = get_contract("PaymentOutputGuardHandler", args=(TxOutputTypes.PAYMENT.value,),
                                                 sender=maintainer)

        self.output_guard_registry.registerOutputGuardHandler(TxOutputTypes.PAYMENT.value,
                                                              self.payment_output_guard.address,
                                                              **{'from': maintainer.address})

    def _setup_exit_games(self, get_contract, maintainer):
        self.payment_exit_game = self._get_payment_exit_game(get_contract, maintainer)
        self.plasma_framework.registerExitGame(TxTypes.PAYMENT.value,
                                               self.payment_exit_game.address,
                                               Protocols.MoreVP.value,
                                               **{'from': maintainer.address}
                                               )

    def _get_payment_exit_game(self, get_contract, maintainer):
        start_exit_lib = get_contract('PaymentStartStandardExit', sender=maintainer)
        challenge_exit_lib = get_contract('PaymentChallengeStandardExit', sender=maintainer)
        process_exit_lib = get_contract('PaymentProcessStandardExit', sender=maintainer)

        payment_exit_game = get_contract("PaymentExitGame",
                                         sender=maintainer,
                                         args=(self.plasma_framework.address,
                                               self.eth_vault.address,
                                               self.erc20_vault.address,
                                               self.output_guard_registry.address,
                                               self.payment_spending_condition_registry.address),
                                         libraries={
                                             "PaymentStartStandardExit": start_exit_lib.address,
                                             "PaymentChallengeStandardExit": challenge_exit_lib.address,
                                             "PaymentProcessStandardExit": process_exit_lib.address,
                                         }
                                         )
        return payment_exit_game

    def blocks(self, block):
        return self.plasma_framework.blocks(block)

    def addToken(self, token, **kwargs):
        return self.plasma_framework.addToken(token, **kwargs)

    def submitBlock(self, block_root, **kwargs):
        self.plasma_framework.submitBlock(block_root, **kwargs)

    def deposit(self, deposit_tx, **kwargs):
        return self.eth_vault.deposit(deposit_tx, **kwargs)

    def depositFrom(self, deposit_tx, **kwargs):
        return self.erc20_vault.deposit(deposit_tx, **kwargs)

    def startStandardExit(self, utxo_pos, output_tx, output_tx_inclusion_proof, **kwargs):
        args = (utxo_pos, output_tx, 1, b'', output_tx_inclusion_proof)
        return self.payment_exit_game.startStandardExit(args, **kwargs)

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
        next_exit_id = top_exit_id if top_exit_id != 0 else self.getNextExit(token)

        tx1_hash = self.plasma_framework.processExits(token, top_exit_id, exits_to_process)
        tx2_hash = self.payment_exit_game.processExit(next_exit_id)
        return tx1_hash, tx2_hash

    def getInFlightExitId(self, tx):
        raise NotImplementedError

    def getStandardExitId(self, tx_bytes, utxo_pos):
        blknum, _, _ = decode_utxo_id(utxo_pos)
        is_deposit = blknum % CHILD_BLOCK_INTERVAL != 0
        return self.payment_exit_game.getStandardExitId(is_deposit, tx_bytes, utxo_pos)

    def getFeeExitId(self, fee_exit_num):
        raise NotImplementedError

    def getNextExit(self, token):
        exit_priority = self.plasma_framework.getNextExit(token)
        _, exit_id = self.plasma_framework.exits(exit_priority)
        return exit_id

    def unpackExitId(self, priority):
        raise NotImplementedError

    def hasToken(self, token):
        return self.plasma_framework.hasToken(token)

    def getInFlightExitOutput(self, tx, output_index):
        raise NotImplementedError

    def nextChildBlock(self):
        return self.plasma_framework.nextChildBlock()

    def nextDepositBlock(self):
        return self.plasma_framework.nextDepositBlock()

    def childBlockInterval(self):
        return self.plasma_framework.childBlockInterval()

    def standardExitBond(self):
        return self.payment_exit_game.startStandardExitBondSize()

    def exits(self, exit_id):
        return self.payment_exit_game.standardExits(exit_id)
