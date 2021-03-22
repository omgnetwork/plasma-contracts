# Quasar Pool Design

> **Note:** the quasar pool mentioned here is a plug-in to pool-in liquid funds from several lenders and make things easy for someone running a quasar contract. It is not an inherent requirement and the most ideal trustless quasar should have funds pooled in only by the quasar operator.

We have the original proposal here - https://github.com/omgnetwork/research-workshop/blob/souradeep/fast_exits/Incognito_fast_withdrawals.md
Which explains a trustless model, And this is a continuation, that explains the choices we made for the first implementation, trading off a bit on the trustless side for easier UX/usability.

## The inception of a quasar pool:

This is what a trustless quasar should look like (this just shows the flows of the funds, some steps about quasar interaction eg: ticket, challenges, ifeClaims haven’t been shown)
![quasar_diagram_without external_pool (2)](https://user-images.githubusercontent.com/26090752/112024138-e5484100-8b59-11eb-979d-2d72e08c6c93.jpg)

Here, the quasar operator would put in funds on the ETH pool, and steps marked # are optional, the quasar owner can do whatever with the funds received on plasma after step 1. 

*Why should an ideal trustless quasar have funds pooled in only by the quasar operator?*

The trustless quasar wouldn’t need to trust anybody including the plasma operator. If you don’t trust the plasma operator, you are saying you don’t accept the validity of the tx inclusion proof (from step 2 of the above diagram). In that case you have your selected window to challenge and prove any false claim wrong (after step 2). So, ideally you should have your funds at stake and challenge whenever there is a need to protect your funds.

Now also note that, the need for a challenge would only come up in case there is a fake inclusion proof (in other words when the chch is byzantine - a mass exit scenario)

We take this fact into advantage - since the plasma operator is also running the quasar, we trust ourselves and hence we have an opportunity to remove the challenge period!

This brings to **change -1) quasar with no challenge period**

So we have - a plasma operator trust’s himself that he wouldn’t go byzantine and hence, pools in funds on the quasar.

Now, we thought we should have people collectively pool-in funds for the quasar pool, instead - which brings in participants to stay engaged with the pool and profits, and mostly to avoid putting up a large sum on the pool ourselves. 

So the trust model change gradually from -

**Initially -**
nobody trust -> nobody

**after no challenge period-**
plasma operator trust -> plasma operator

**With multiple suppliers pool-**

*1) With collateral by operator,*
      plasma operator trust -> plasma operator
*2) Without collateral by operator,*
           Lenders trust -> plasma operator 

We went with B) 

This brings to change **-2) quasar pool with multiple suppliers**,


The structure now looks like-
![quasar_diagram_with external_pool (1)](https://user-images.githubusercontent.com/26090752/112024174-ee391280-8b59-11eb-8406-fa7d7d460e98.jpg)

We tried to make it look similar to Compound ( think the Quasar contract is the compound supply pool). The borrowers are the exiters, but the one who repays is us(the trusted plasma-operator).

Compound generates returns on the basis of block time. We do it on the basis of the number of exits. 

## Returns calculation: 

Every output you send to the quasar owner on Plasma, you can withdraw 
(output_val - quasar_fee)
from the quasar contract on Ethereum. 

This quasar_fee margin will be distributed among the pool of lenders in the ratio of each lender’s stake.
The calculation, we do it in a very similar way to a defi lending protocol, using qTokens!

Each token supplied to the pool has it’s exchangeRatio(k)
Supply to the pool,
                    for instance OMG will mint qOMG = OMG / k for the supplier
On Withdrawals,
                    qOMG is burnt and OMG = qOMG * k is withdrawn

The exchangeRatio (k) accounts for the returns you would get.

Fees accumulate in the pool every time a fast exit happens, and k updates to
k’ = f / Tq + k

Where f = fixed quasar_fee from every exit
           Tq = total qTokens supply

Here is a proof, for the equation https://github.com/omgnetwork/plasma-contracts/issues/728#issuecomment-760936145

Sample run, return calculations
https://github.com/omgnetwork/brainstorm/tree/main/quasarPool_returns

**Per exit:**
Note, the fee has to be distributed for each qToken in the supply of the pool. (the qTokens denote the total supply of the pool)
So, your return per exit  = no of qTokens you have * fee per qToken

If there are many lenders to the pool, the fee per qToken would be less
If there are small no of lenders, the fee per qToken is more.

We want the no of qToken in the pool to adjust automatically according to their return requirements,
(and how will they? )
When people supply, more qTokens, 
when people withdraw less qTokens in supply

**Per week:**
This gives a better idea of the movement in the pool as this brings in no of exits into equation.
Also, a thing to note is the returns are compounded.

Returns per week =
 (quasar_fee per exit * no of exits in the week * no of your qTokens) / qToken total supply  

This means the returns will increase/decrease with the increase/decrease in the no of exits

**Scenario 1**
When no of exits increase, pool supply is idle:

Returns per lender increases,
this could attract more lenders to supply,
Which in turn could again normalise the return to the average rate,

If lenders aren’t attracted, the existing suppliers enjoy higher rates.


**Scenario 2**
When no of exits decrease, pool supply is idle:

Returns per lenders decrease,
This could mean lenders withdrawing and moving away because it’s just not enough for them
The one’s who still stay in the pool enjoy higher rates as lender’s move out.
This normalises the return rate to average again

If lender’s dont leave, all of them are happy with a lower return rate


**Scenario 3**
When no one supplies to the pool:

If even one person puts in a supply. He owns all of the qTokenSupply, gets all the returns to himself, which should be quite high.

This makes it a self-regulating pool, in terms of the need or use of fast -exits in the system.


**The idea is more number of fast exit’s would need a higher liquidity pool size, and from scenario 1 this incentivizes people to supply more**

**And, similarly if there isn’t enough fast exit’s happening, we are better of with a small pool size( since that could be enough liquidity for these small no of exit’s happening)**


This sums up the tweaks we made on the quasar, apart from another minor tweak in the auto determination of a safe-block-num (which you can find in the first doc).
