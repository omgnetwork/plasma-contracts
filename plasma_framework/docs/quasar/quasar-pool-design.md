# Quasar Pool Design

> **Note:** the Quasar pool mentioned here is a plug-in to pool-in liquidity from several lenders and make things easy for someone running a Quasar contract. It is not an inherent requirement and the most ideal trustless Quasar should have funds pooled in only by the Quasar Owner.

We have the original proposal here - https://github.com/omgnetwork/plasma-contracts/blob/master/plasma_framework/docs/quasar/quasar-fast-withdrawals.md
which explains a fully trustless model. 

This is a continuation that explains the choices we made for the first implementation, trading off a bit on the trustless side for easier UX/usability.

## The inception of a Quasar pool:

This is what a trustless Quasar should look like (this just shows the flows of the funds, some steps about Quasar interaction eg: ticket, challenges, ifeClaims haven’t been shown) <br><br>
![quasar_diagram_without external_pool](https://user-images.githubusercontent.com/26090752/112024138-e5484100-8b59-11eb-979d-2d72e08c6c93.jpg)

Here, the Quasar operator would put in funds on the ETH pool, and steps marked # are optional, the Quasar owner can do whatever they want with the funds received on plasma after step 1. 

*Why should an ideal trustless Quasar have funds pooled in only by the Quasar operator?*

A trustless Quasar shouldn’t need to trust anybody including the plasma operator. If you don’t trust the plasma operator, you are saying you may accept the validity of the tx inclusion proof (from step 2 of the above diagram). In that case you have a challenge period and prove any false claim wrong (after step 2). So, ideally you should have your own funds at stake and challenge whenever there is a need to protect your funds.

Now also note that the need for a challenge would only come up in case there is a invalid inclusion proof (in other words when the child chain is byzantine - a mass exit scenario)

In this implementation the plasma operator is also running the Quasar - we trust ourselves and hence we have an opportunity to remove the challenge period!

This brings us to:
## Change 1. Quasar with no challenge period

So we have - a plasma operator that trusts himself that he won't go byzantine and hence, pools in funds on the Quasar.

Now, we thought we should have people collectively pool-in funds for the Quasar pool, instead - which brings in participants to stay engaged with the pool and profits, and mostly to avoid putting up a large sum on the pool ourselves. 

So the trust model change gradually from -

**Initially:** Nobody trusts anybody.

**With no challenge period:** plasma operator -> plasma operator

**With multiple suppliers pool:** There are 2 choices:

 - *A) With collateral by operator:*
      plasma operator trust -> plasma operator
 - *B) Without collateral by operator:*
           Lenders trust -> plasma operator 

We went with option B) 

This brings us to:
## Change 2. Quasar pool with multiple suppliers


The structure now looks like this <br><br>
![quasar_diagram_with external_pool](https://user-images.githubusercontent.com/26090752/112024174-ee391280-8b59-11eb-8406-fa7d7d460e98.jpg)

We tried to make it look similar to Compound (think the Quasar contract is the compound supply pool). The borrowers are the exiters, but the one who repays is us (the trusted plasma operator).

Compound generates returns on the basis of block time. We do it on the basis of the number of exits. 

## Returns calculation: 

Every output you send to the Quasar owner on Plasma, you can withdraw 
`output_val - quasar_fee`
from the Quasar contract on Ethereum. 

This `quasar_fee` margin will be distributed among the pool of lenders in the ratio of each lender’s stake.
The calculation, we do it in a very similar way to a defi lending protocol, using qTokens.

Each token supplied to the pool has its exchangeRatio (`k`).

When liquidity is supplied to the pool, we mint `qOMG = OMG / k` for the supplier.

On withdrawal, qOMG is burnt and `OMG = qOMG * k` is withdrawn.

The exchangeRatio (`k`) determines the returns you get.

Fees accumulate in the pool every time a fast exit happens, and `k` updates to
`k’ = f / Tq + k`

Where 
- `f` = fixed quasar_fee from every exit
- `Tq` = total qTokens supply

Here is a proof for the equation https://github.com/omgnetwork/plasma-contracts/issues/728#issuecomment-760936145

Sample run, return calculations
https://github.com/omgnetwork/brainstorm/tree/main/quasarPool_returns

### Returns Per Exit

Note, the fee has to be distributed for each qToken in the supply of the pool. (the qTokens denote the total supply of the pool)

So your return per exit = no of qTokens you have * fee per qToken

If there are many lenders to the pool, the fee per qToken would be less
If there are small no of lenders, the fee per qToken is more.

We want the number of qToken in the pool to adjust automatically according to their return requirements.

When people supply, more qTokens.
when people withdraw, less qTokens in supply

### Returns Per Week
This gives a better idea of the movement in the pool as this brings the number of exits into the equation.
Also, a thing to note is the returns are compounded.

`Returns per week = (quasar_fee per exit * no of exits in the week * no of your qTokens) / qToken total supply  `

This means the returns will increase/decrease with the increase/decrease in the number of exits

### Scenario 1
When the number of exits increases, pool supply is idle:

Returns per lender increases, which may attract more lenders to supply,
which in turn could again normalise the return to the average rate,

If new lenders aren’t attracted, the existing suppliers enjoy higher rates.

### Scenario 2
When the number of exits decreases, pool supply is idle:

Returns per lenders decrease, which could mean some lenders withdraw from the pool. The ones who stay in the pool enjoy higher returns. This normalises the return rate to average again

If lenders dont leave, all of them are happy with the lower return rate


### Scenario 3
When no one supplies to the pool:

If even one person puts in a supply. He owns all of the qTokenSupply, gets all the returns to himself, which should be quite high.

This makes it a self-regulating pool, in terms of the need or use of fast exits in the system.


**The idea is that a higher number of fast exits would need a higher liquidity pool size, and scenario 1 shows that this will incentivize people to supply more**

**Similarly if there aren't enough fast exit happening, we are better off with a small pool size(since that would be enough liquidity for a smaller number of exits)**


This sums up the tweaks we made on the Quasar, apart from another minor tweak in the auto determination of a safe-block-num (which you can find in the first doc).
