import enum

from eth_utils import keccak
from plasma_core.constants import CHILD_BLOCK_INTERVAL, EMPTY_BYTES, NULL_ADDRESS
from plasma_core.transaction import TxOutputTypes, TxTypes, Transaction
from plasma_core.utils.transactions import decode_utxo_id
from plasma_core.utils.exit_priority import parse_exit_priority
from .constants import EXIT_PERIOD, INITIAL_IMMUNE_EXIT_GAMES, INITIAL_IMMUNE_VAULTS, SAFE_GAS_STIPEND
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

        self._setup_deposit_verifiers(get_contract, maintainer)
        self._setup_vaults(get_contract, maintainer)
        self._setup_spending_conditions(get_contract, maintainer)
        self._setup_state_verifiers(get_contract, maintainer)
        self._setup_exit_games(get_contract, maintainer)

    def _setup_deposit_verifiers(self, get_contract, maintainer):
        self.eth_deposit_verifier = get_contract(
            'EthDepositVerifier',
            args=(TxTypes.PAYMENT.value, TxOutputTypes.PAYMENT.value,),
            sender=maintainer)
        self.erc20_deposit_verifier = get_contract(
            'Erc20DepositVerifier',
            args=(TxTypes.PAYMENT.value, TxOutputTypes.PAYMENT.value,),
            sender=maintainer)

    def _setup_vaults(self, get_contract, maintainer):
        self.eth_vault = get_contract('EthVault', args=(self.plasma_framework.address, SAFE_GAS_STIPEND,), sender=maintainer)
        self.erc20_vault = get_contract('Erc20Vault', args=(self.plasma_framework.address,), sender=maintainer)

        self.eth_vault_id = 1
        self.eth_vault.setDepositVerifier(self.eth_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(self.eth_vault_id, self.eth_vault.address, **{"from": maintainer.address})

        self.erc20_vault_id = 2
        self.erc20_vault.setDepositVerifier(self.erc20_deposit_verifier.address, **{"from": maintainer.address})
        self.plasma_framework.registerVault(self.erc20_vault_id, self.erc20_vault.address,
                                            **{"from": maintainer.address})

    def _setup_spending_conditions(self, get_contract, maintainer):
        self.spending_conditions = dict()
        self.spending_condition_registry = get_contract("SpendingConditionRegistry", sender=maintainer)

        def _register_spending_condition(spending_condition, tx_output_type, tx_type):
            self.spending_conditions[(tx_output_type, tx_type)] = get_contract(
                spending_condition,
                args=(
                    self.plasma_framework.address,
                    tx_output_type.value,
                    tx_type.value),
                sender=maintainer)

            self.spending_condition_registry.registerSpendingCondition(
                tx_output_type.value,
                tx_type.value,
                self.spending_conditions[(tx_output_type, tx_type)].address,
                **{'from': maintainer.address}
            )

        _register_spending_condition("PaymentOutputToPaymentTxCondition", TxOutputTypes.PAYMENT, TxTypes.PAYMENT)
        self.spending_condition_registry.renounceOwnership(**{'from': maintainer.address})

    def _setup_state_verifiers(self, get_contract, maintainer):
        self.payment_state_verifier = get_contract('PaymentTransactionStateTransitionVerifier', sender=maintainer)

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
            'PaymentDeleteInFlightExit',
            'PaymentProcessInFlightExit',
        ]

        libs, libs_map = self._deploy_libraries(libs, get_contract, maintainer)

        payment_exit_game_args = (
            self.plasma_framework.address,
            self.eth_vault_id,
            self.erc20_vault_id,
            self.spending_condition_registry.address,
            self.payment_state_verifier.address,
            TxTypes.PAYMENT.value,
            SAFE_GAS_STIPEND,
        )
        payment_exit_game = get_contract("PaymentExitGame",
                                         args=(payment_exit_game_args,),
                                         libraries=libs_map)
        payment_exit_game.init(**{'from': maintainer.address})
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

    @property
    def address(self):
        return self.plasma_framework.address

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
        args = (utxo_pos, output_tx, output_tx_inclusion_proof)
        return self.payment_exit_game.startStandardExit(args, **kwargs)

    def challengeStandardExit(self,
                              standard_exit_id, challenge_tx,
                              input_index,
                              challenge_tx_sig,
                              exiting_tx,
                              senderData,
                              **kwargs):
        """ NOTICE: ALD takes more obligatory arguments (exiting_tx) in comparison to the RootChain contract """

        witness = challenge_tx_sig
        args = (standard_exit_id,
                exiting_tx,
                challenge_tx,
                input_index,
                witness,
                senderData)

        return self.payment_exit_game.challengeStandardExit(args, **kwargs)

    def startFeeExit(self, token, amount):
        raise NotImplementedError

    def startInFlightExit(self,
                          in_flight_tx,
                          input_txs,
                          input_txs_inclusion_proofs,
                          in_flight_tx_sigs,
                          input_utxos_pos,
                          **kwargs):

        in_flight_tx_witnesses = in_flight_tx_sigs

        args = [in_flight_tx,
                input_txs,
                input_utxos_pos,
                input_txs_inclusion_proofs,
                in_flight_tx_witnesses]

        self.payment_exit_game.startInFlightExit(args, **kwargs)

    def piggybackInFlightExit(self, in_flight_tx, output_index, **kwargs):
        if output_index < Transaction.NUM_INPUTS:
            args = (in_flight_tx, output_index)
            self.payment_exit_game.piggybackInFlightExitOnInput(args, **kwargs)
        else:
            args = (in_flight_tx, output_index - Transaction.NUM_INPUTS, EMPTY_BYTES)
            self.payment_exit_game.piggybackInFlightExitOnOutput(args, **kwargs)

    def challengeInFlightExitNotCanonical(self, in_flight_tx,
                                          in_flight_tx_input_index,
                                          competing_tx,
                                          competing_tx_input_index,
                                          competing_tx_pos,
                                          competing_tx_inclusion_proof,
                                          competing_tx_sig,
                                          input_tx,
                                          input_utxo_pos,
                                          **kwargs):

        competing_tx_witness = competing_tx_sig

        args = (
            input_tx,
            input_utxo_pos,
            in_flight_tx,
            in_flight_tx_input_index,
            competing_tx,
            competing_tx_input_index,
            competing_tx_pos,
            competing_tx_inclusion_proof,
            competing_tx_witness
        )

        self.payment_exit_game.challengeInFlightExitNotCanonical(args, **kwargs)

    def respondToNonCanonicalChallenge(self, in_flight_tx, in_flight_tx_pos, in_flight_tx_inclusion_proof):
        self.payment_exit_game.respondToNonCanonicalChallenge(in_flight_tx, in_flight_tx_pos, in_flight_tx_inclusion_proof)

    def challengeInFlightExitInputSpent(self, in_flight_tx,
                                        in_flight_tx_input_index,
                                        spending_tx,
                                        spending_tx_input_index,
                                        spending_tx_sig,
                                        input_tx,
                                        input_tx_txo_pos,
                                        senderData,
                                        **kwargs):

        spending_tx_witness = spending_tx_sig

        args = (
            in_flight_tx,
            in_flight_tx_input_index,
            spending_tx,
            spending_tx_input_index,
            spending_tx_witness,
            input_tx,
            input_tx_txo_pos,
            senderData
        )

        self.payment_exit_game.challengeInFlightExitInputSpent(args, **kwargs)

    def challengeInFlightExitOutputSpent(self, in_flight_tx,
                                         in_flight_tx_output_pos,
                                         in_flight_tx_inclusion_proof,
                                         spending_tx,
                                         spending_tx_input_index,
                                         spending_tx_sig,
                                         senderData,
                                         **kwargs):

        spending_tx_witness = spending_tx_sig

        args = (
            in_flight_tx,
            in_flight_tx_inclusion_proof,
            in_flight_tx_output_pos,
            spending_tx,
            spending_tx_input_index,
            spending_tx_witness,
            senderData
        )
        self.payment_exit_game.challengeInFlightExitOutputSpent(args, **kwargs)

    def processExits(self, token, top_exit_id, exits_to_process, sender, vault_id=None):
        if vault_id is None:
            if token == NULL_ADDRESS:
                vault_id = self.eth_vault_id
            else:
                vault_id = self.erc20_vault_id

        return self.plasma_framework.processExits(vault_id, token, top_exit_id, exits_to_process, keccak(hexstr=sender), **{"from": sender})

    def deleteNonPiggybackedInFlightExit(self, exit_id):
        return self.payment_exit_game.deleteNonPiggybackedInFlightExit(exit_id)

    def getInFlightExitId(self, tx):
        return self.payment_exit_game.getInFlightExitId(tx)

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

    def processStandardExitBounty(self):
        return self.payment_exit_game.processStandardExitBountySize()

    def processInFlightExitBounty(self):
        return self.payment_exit_game.processInFlightExitBountySize()

    def inFlightExitBond(self):
        return self.payment_exit_game.startIFEBondSize()

    def piggybackBond(self):
        return self.payment_exit_game.piggybackBondSize()

    def exits(self, exit_ids):
        return self.payment_exit_game.standardExits(exit_ids)

    def inFlightExits(self, exit_ids):
        return self.payment_exit_game.inFlightExits(exit_ids)

    # additional convenience proxies (not taken from RootChain) #

    def isOutputFinalized(self, utxo_pos):
        return self.plasma_framework.isOutputFinalized(utxo_pos)
