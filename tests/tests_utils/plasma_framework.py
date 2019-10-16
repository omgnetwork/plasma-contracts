import enum

from plasma_core.constants import CHILD_BLOCK_INTERVAL
from plasma_core.transaction import TxOutputTypes, TxTypes
from plasma_core.utils.transactions import decode_utxo_id
from plasma_core.utils.exit_priority import parse_exit_priority
from .constants import EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES, INITIAL_IMMUNE_VAULTS
from .convenience_wrappers import ConvenienceContractWrapper


class Protocols(enum.Enum):
    MVP = 1
    MoreVP = 2


class PlasmaFramework:
    def __init__(self, get_contract, maintainer, authority):
        self.plasma_framework = get_contract(
            'PlasmaFramework',
            args=(
                EXIT_PERIOD,
                INITIAL_IMMUNE_VAULTS,
                INITIAL_IMMUNE_EXIT_GAMES,
                authority.address,
                maintainer.address,
            ),
            sender=maintainer
        )

        self.plasma_framework.activateChildChain(**{"from": authority.address})

        self._setup_deposit_verifiers(get_contract, maintainer)
        self._setup_vaults(get_contract, maintainer)
        self._setup_output_guards(get_contract, maintainer)
        self._setup_spending_conditions(get_contract, maintainer)
        self._setup_state_verifiers(get_contract, maintainer)
        self._setup_exit_games(get_contract, maintainer)

    def _setup_deposit_verifiers(self, get_contract, maintainer):
        self.eth_deposit_verifier = get_contract('EthDepositVerifier', sender=maintainer)
        self.erc20_deposit_verifier = get_contract('Erc20DepositVerifier', sender=maintainer)

    def _setup_vaults(self, get_contract, maintainer):
        self.eth_vault = get_contract('EthVault', args=(self.plasma_framework.address,), sender=maintainer)
        self.erc20_vault = get_contract('Erc20Vault', args=(self.plasma_framework.address,), sender=maintainer)

        self.eth_vault_id = 1
        self.eth_vault.setDepositVerifier(self.eth_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(self.eth_vault_id, self.eth_vault.address, **{"from": maintainer.address})

        self.erc20_vault_id = 2
        self.erc20_vault.setDepositVerifier(self.erc20_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(self.erc20_vault_id, self.erc20_vault.address, **{"from": maintainer.address})

    def _setup_spending_conditions(self, get_contract, maintainer):
        self.spending_condition_registry = get_contract("SpendingConditionRegistry", sender=maintainer)

    def _setup_output_guards(self, get_contract, maintainer):
        self.output_guard_registry = get_contract("OutputGuardHandlerRegistry", sender=maintainer)

        self.payment_output_guard = get_contract("PaymentOutputGuardHandler", args=(TxOutputTypes.PAYMENT.value,),
                                                 sender=maintainer)

        self.output_guard_registry.registerOutputGuardHandler(TxOutputTypes.PAYMENT.value,
                                                              self.payment_output_guard.address,
                                                              **{'from': maintainer.address})

    def _setup_state_verifiers(self, get_contract, maintainer):
        self.payment_state_verifier = get_contract('PaymentTransactionStateTransitionVerifier', sender=maintainer)
        self.tx_finalization_verifier = get_contract('TxFinalizationVerifier', sender=maintainer)

    def _setup_exit_games(self, get_contract, maintainer):
        self.payment_exit_game = self._get_payment_exit_game(get_contract, maintainer)

        self.plasma_framework.registerExitGame(TxTypes.PAYMENT.value,
                                               self.payment_exit_game.address,
                                               Protocols.MoreVP.value,
                                               **{'from': maintainer.address}
                                               )

    def _get_payment_exit_game(self, get_contract, maintainer):
        libs = [
            'PaymentStartStandardExit',
            'PaymentChallengeStandardExit',
            'PaymentProcessStandardExit',
            'PaymentStartInFlightExit',
            'PaymentPiggybackInFlightExit',
            'PaymentChallengeIFENotCanonical',
            'PaymentChallengeIFEInputSpent',
            'PaymentChallengeIFEOutputSpent',
            'PaymentProcessInFlightExit',
        ]

        libs, libs_map = self._deploy_libraries(libs, get_contract, maintainer)

        payment_exit_game = get_contract("PaymentExitGame",
                                         sender=maintainer,
                                         args=(self.plasma_framework.address,
                                               self.eth_vault_id,
                                               self.erc20_vault_id,
                                               self.output_guard_registry.address,
                                               self.spending_condition_registry.address,
                                               self.payment_state_verifier.address,
                                               self.tx_finalization_verifier.address,
                                               TxTypes.PAYMENT.value,
                                               ),
                                         libraries=libs_map)

        return payment_exit_game

    @staticmethod
    def _deploy_libraries(libraries, get_contract, sender):
        lib_map = dict()
        libs = []
        for lib_name in libraries:
            library = get_contract(lib_name, sender=sender)
            lib_map[lib_name] = library.address
            libs.append(library)

        return libs, lib_map

    def event_filters(self, w3):
        filters = dict()

        for attribute in dir(self):
            attribute = getattr(self, attribute)
            if isinstance(attribute, ConvenienceContractWrapper):
                contract_filter = w3.eth.filter({'address': attribute.address, 'fromBlock': 'latest'})
                filters[attribute.address] = attribute, contract_filter

        return filters

    def blocks(self, block):
        return self.plasma_framework.blocks(block)

    def addExitQueue(self, vaultId, token, **kwargs):
        return self.plasma_framework.addExitQueue(vaultId, token, **kwargs)

    def submitBlock(self, block_root, **kwargs):
        self.plasma_framework.submitBlock(block_root, **kwargs)

    def deposit(self, deposit_tx, **kwargs):
        return self.eth_vault.deposit(deposit_tx, **kwargs)

    def depositFrom(self, deposit_tx, **kwargs):
        return self.erc20_vault.deposit(deposit_tx, **kwargs)

    def startStandardExit(self, utxo_pos, output_tx, output_tx_inclusion_proof, **kwargs):
        args = (utxo_pos, output_tx, b'', output_tx_inclusion_proof)
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

    def processExits(self, vaultId, token, top_exit_id, exits_to_process):
        return self.plasma_framework.processExits(vaultId, token, top_exit_id, exits_to_process)

    def getInFlightExitId(self, tx):
        raise NotImplementedError

    def getStandardExitId(self, tx_bytes, utxo_pos):
        blknum, _, _ = decode_utxo_id(utxo_pos)
        is_deposit = blknum % CHILD_BLOCK_INTERVAL != 0
        return self.payment_exit_game.getStandardExitId(is_deposit, tx_bytes, utxo_pos)

    def getFeeExitId(self, fee_exit_num):
        raise NotImplementedError

    def getNextExit(self, vaultId, token):
        exit_priority = self.plasma_framework.getNextExit(vaultId, token)
        return parse_exit_priority(exit_priority)

    def unpackExitId(self, priority):
        raise NotImplementedError

    def hasExitQueue(self, vaultId, token):
        return self.plasma_framework.hasExitQueue(vaultId, token)

    def getInFlightExitOutput(self, tx, output_index):
        raise NotImplementedError

    def nextChildBlock(self):
        return self.plasma_framework.nextChildBlock()

    def nextDepositBlock(self):
        return self.plasma_framework.nextDeposit()

    def getDepositBlockNumber(self):
        return self.plasma_framework.nextDepositBlock()

    def childBlockInterval(self):
        return self.plasma_framework.childBlockInterval()

    def standardExitBond(self):
        return self.payment_exit_game.startStandardExitBondSize()

    def exits(self, exit_id):
        return self.payment_exit_game.standardExits(exit_id)

    # additional convenience proxies (not taken from RootChain) #

    def isOutputSpent(self, utxo_pos):
        return self.plasma_framework.isOutputSpent(utxo_pos)
