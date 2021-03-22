# Quasar Fast Withdrawals
This is an attempt to reduce the time to get liquid funds to <= 24 hrs.
The following approach to some extent, combines ideas from the `Atomic Swap` and `Vending Machine way` of Fast Withdrawals. But Unlike the Vending Machine way, this is a trustless way to exchange funds using an on-chain smart contract. Which would enable almost anyone (not only limited to token-issuers or partners) to provide the service for incentives. This approach also pushes for bringing the liquidity providers to the exiters, hence eliminating the requirement of a token market.

## Overview
Exchanging/Swapping assets is done with the help of Tx inclusion proofs

To put it briefly, the UX for Alice, who has PETH and wants ETH-
* Alice confirms the UTXO which she wants to exit (obtains a ticket from the on-chain contract)
* Alice spends the UTXO in a tx to the on-chain contract owner
* Then she waits for the tx confirmation, provides inclusion proof to the contract and claims on-chain funds

Alice would pay a fee to the on-chain contract owner instead of bearing the gas cost for exiting the UTXO

## The Process in Detail
The on-chain contract is the main component which enables the trustless asset exchange. 

The contract has to be setup by the owner with certain params for functioning. So lets call this setup - a Quasar for now (because Quasar's are cool). So Ideally there will be multiple Quasars in the network, which could each allow a portal for Fast Withdrawals.

### Setting Up
Anyone could set up a Quasar, for any definite period of time and with whatever amount for liquidation.
The steps-
1. Deploy the contract, also setting the following attributes
	- The Owner - the account which will receive the funds on Plasma; should be a fresh account with no history of tx
	- Safe blocknum (upper-bound) - This is the latest decided safe block by the owner; to acknowledge tickets for UTXOs from this or older blocks; see [reason](#Operator-goes-Byzantine)
	- Waiting period - the time to wait from the contract receiving inclusion proofs to providing liquid funds; to protect against operator+user collusion only; see [reason](#Operator-allows-a-double-spend-tx-of-Alice)

2. Load the contract with on-chain funds to make it ready

### Using and Withdrawing
Let's take Alice who has certain amount of PETH, the process she has to go through in order to get liquid funds instantly-
1. Alice takes a note of the UTXO that she wants to exit. She has options to select any Quasar out there, comparing the waiting period and the safe blocknum upper-bounds for each of them.
2. Alice obtains a ticket from one of these Quasars, specifying her UTXO. The intention of the ticket is to reserve the amount from the contract. The ticket is valid for a certain period of time and can only be obtained for UTXOs which are within limits of the specified blocknum upper-bound; see [reason](#Owner-races-to-clear-liquid-funds)
3. After successfully obtaining the ticket, Alice spends the UTXO in a tx to the Owner. The Tx should only include inputs owned by Alice [reason](#IFE-Claims)
4. After the tx is confirmed, Alice submits a claim to the Quasar with the inclusion proof of the tx and the ticket.
5. The claim gets added to the Quasars queue with a very short waiting period. The waiting period allows for a chance where the Owner could challenge if the Operator colludes with the user
6. After the waiting period passes, upon executing the queue the contract sends rootchain funds to Alice

### Maintainance
The Owner needs to maintain the Quasar contract from time-to-time in the following ways-
* The Owner has to update the safe blocknum upper-bound in intervals. This is totally dependent on the owner and in an ideal situation of multiple quasar options, even newer Utxos should be able to find one.
* The waiting period can be freely set by the Owner. Since, the waiting period is only useful in the rare case of the operator submitting invalid blocks(double spent), the period can be set to even lower than 24hrs or can be removed, if they wish to trust the operator
* The Owner can periodically exit funds from plasma, and refill the value of liquid funds
* The Owner can choose to unload the liquid funds contained in the contract. To retract funds the owner should first freeze the contract which would stop giving away new tickets. The active tickets are still valid, and the remaining portion of liquid funds not covered by the ticket can be unloaded.

#### Mandatory Actions
The Owner needs to necessarily -
* Challenge Claims - Challenge usual fast exit claim within the waiting period from the time of the claim
* Challenge IFE-Claim - Challenge [IFE-Claims](#IFE-Claims) within 7+x days (IFE finalization + buffer) from the time of the claim

## Byzantine Condition

### Freeze during Byzantine Condition

If the current state is determined to be Byzantine, the Owner should -
1. Avoid updating the Safe Blocknum upper-bound
2. Should freeze the contract to stop giving away new tickets
The existing active tickets however are valid and IFE-Claims can be used to recover these funds.

Note that freezing the contract has to be done within REP ([unless automatic safe block is set](#Automating_maintainance_of_the_Safe_Blocknum_upper-bound)), hence time-limited to one-week, but should be done sooner by the Owner to reduce the hassle.

### IFE-Claims

In the case when the operator doesn't include Alice's Tx in a block or is even withholding entire blocks, Alice wouldn't have the Tx inclusion proof to claim funds in the usual way from the Quasar. An IFE-Claim is necessary here to recover funds when Alice's Tx to the Quasar Owner is withheld by the Byzantine Operator. 

To recover funds -
1. Alice starts an IFE on the Tx to the Quasar. Note that an IFE has to be started before starting an IFE-claim, since starting an IFE on the TX also proves it to be exitable.
2. Alice calls the IFEClaim method on the Quasar contract
3. Alice should not try to double spend the input that was spent with the Tx to ensure the Tx is always canonical
4. The Quasar owner has to Piggyback the output of this Tx
5. The IFE-claim on the Quasar here has a higher waiting period here (buffer + IFE finalization time) in order to have enough time to challenge if it is an invalid claim
6. The Quasar Owner gets the output after the IFE is finalized, and Alice receives the liquid funds from the Quasar contract after the waiting period

However in Step 3, if Alice tries to double spend-
1. The double spend Tx is used to challenge the IFE and is determined to be non-canonical
2. The same Tx is used by the Quasar Owner to invalidate Alice's IFE-claim on the Quasar contract


## Possible Incentives for the Owner

### Fees for the happy path

The fee could comprise of/ should include two portions-
1. The cost of challenging in case the [Operator allows a double-spend tx of Alice](#Operator-allows-a-double-spend-tx-of-Alice)

2. The fee for providing the service - Since the waiting period of every Quasar is customizable, the fee can be dependent on the waiting period, opening multiple options of usability. The fee can also alternatively be a cut from the amount.

Another thing to note here, is since their is no actual exits of funds from the chch, Alice doesn't have to pay for the cost of processing an exit (the bounty). While, also the Quasar Owner has the option to merge multiple UTXOs on the chch before exiting. Altogether, less tx fees are spent on processing exits. Hence, the Quasar Owner doesn't need to include the cost of exiting the output in the fee.
The design of the fees should take this fact into consideration since, Alice would normally have to pay the bounty for a Standard Exit, but as an alternative here, she has to pay only a fee to the Quasar which could ideally be of similar size.

### Fees for IFE-Claim

The IFE-Claim's should be disincentivized by having a higher fee and should only be used on requirement. The IFE-Claim process also requires the Owner to Piggyback. This cost should be borne by Alice and can be included with the fee to the Quasar.

The IFE-Claim is already disincentivized to some extent by having a higher waiting period than a normal IFE. So The fee for an IFE-Claim could simply include - 
1. Fee of happy path 
2. Piggyback cost of ouptut
3. Challenge IFE-Claim cost


## Potential Attacks and their Mitigations

### Attacks by Alice

#### DoS tickets 
Obtaining a ticket from a Quasar blocks the amount from the Quasar's real limit. So obtaining several tickets without actually using them will block the capacity of the Quasar. 
The solution is to have a bond, which can be taken for providing the ticket, and can be returned on claiming the tickets. This can be looked as to be similar to the exit bond. There can be other approaches too, where the service fee is taken while obtaining tickets.

#### Ticket for a fake UTXO
A ticket can be obtained for a fake UTXO but while reclaiming liquids funds the inclusion proof of the tx between Alice and Owner is required

#### Alice attempts to exit from the UTXO after submitting the claim
Alice needs the inclusion proof in order to claim liquid funds. So assuming the tx to the Quasar owner was confirmed, if Alice tries to exit, it is challenged.

If Alice starts an IFE-Claim, the same double spending tx can be used to challenge both the IFE and the claim

#### Alice uses the inclusion proofs of same UTXO twice
Alice can get the ticket for any given UTXO, so it is possible for Alice to try claiming funds twice with the same inclusion proof.
The solution is to have a utxo map maintained by the Quasar which can eradicate this. Also in the case of Alice trying to use a different Quasar with an older proof will not succeed since the recipient of the UTXO will not be the Quasar owner.

### Attacks by the Quasar owner
#### Owner races to clear liquid funds
For situations where The Owner immediately generates a ticket and tries to empty the liquidity funds before Alice claims, the owner still cannot generate a ticket with a value higher than the real(updated) capacity.

#### Owner spends the outputs upon receiving
The Owner could spend the output right away after Alice sends it. But this does not impact Alice, beacuse she can still claim the funds with the inclusion proof and the ticket.

#### Owner retracts liquid funds from contract
The Owner cannot try to take away liquid funds and empty the contract between the time Alice takes to claim after transferring. Since, the ticket books the certain capacity for Alice till the time the ticket is valid
Alice can safely extract funds as long as the ticket is valid


### Attacks by the Operator
#### Operator publishes invalid block
If Alice's tx to the Owner is included before the invalid Tx, the Owner can SE to get the funds

IF Alice's tx to the Owner is included after the invalid Tx, the Owner can IFE to get the funds

#### After Operator goes Byzantine
If after the operator goes Byzantine, the operator still submits blocks,  the users can still make successive transaction and get proofs for them. This however, will not allow them to use the Quasars. For the older UTXOs (within the limit of the blocknum upper bound specified by the owner) that are transferred, the Owners could still exit, but for successive transfers after the operator goes byzantine, tickets will not be obtainable as it would be a UTXO from a blocknum that was after the safe upper-bound

#### Operator doesn't include Alice's tx to Owner
If the operator withholds the tx, Alice can start an IFE-Claim to recover her funds

#### Operator allows a double-spend tx of Alice
This is the only rare chance which brings in the usage of the waiting period.

Alice spends UTXO1 in TX1 to Malorie, and then Alice somehow manages to convince the Operator to include a transaction TX2, this time to the Quasar Owner, spending the UTXO1 again. Though the Owner cannot exit this, The contract would still allow Alice to claim liquid funds through UTXO1 (given UTXO1 was within the safe blocknum-upper bound)

The waiting period set for the Quasar protects against this. The Owner should validate their queue, and challenge Alice's claim by revealing an older spend of UTXO1 within the waiting period. Since, this is rare, happening only when the Operator colludes with Alice, if someone trusts the Operator, or the Operator himself could run a Quasar without the need for validation, with a zero waiting period.

## Alternative Modifications to the approach

### Single Liquidity Pool

An alternative is to have a single liquidity pool instead of having seperate contracts with their own liquidity.

 - fee can be distributed among liquidity providers
 - removes the requirement of running separate contracts for each liqudiity provider
 - however, this could potentially prevent from keeping the waiting period low. Since every swap is from the same pool, Liquidity provider's are no more accountable for the safety of thier liquid funds.
 - can be an option when you want to delegate the task of challenging to a small set of other trusted user(s)

### Automating maintainance of the Safe Blocknum upper-bound

In the current design, there is a requirement for the Quasar owner to constantly keep updating the Safe Blocknum upper-bound. 
An alternative could be -
Provide tickets for a UTXO if either one of these satisfy:
 - UTXOs is older than (Latest_Block_timestamp - Buffer), ideally the buffer could take the value of the minimum validation period.
 or
 - UTXO is from a safe block (determined by safe blocknum upper-bound) set by the Owner

### Output funds in different form

Since the fast withdrawal way is essentially a swap of assets between users on different layers. The swap can be extended to provide fund outputs in any form. Instead of providing with Liquid funds, a deposit Tx to another Layer 2 could be created (enforcing a swap instead of an exit).
