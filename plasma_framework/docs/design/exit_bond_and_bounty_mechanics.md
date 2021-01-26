# Exit Bond and Bounty Mechanics

This document is a description of the current implementation of exit bonds and process exit bounties which are an integral part of the exit mechanism.
### Terminology

- **Exit Initiator** The user who starts an exit by either calling `startStandardExit()` or piggybacking on an in-flight exit
- **Challenger** The user who challenges a standard exit, an in-flight exit or a piggyback
- **Exit Processor** The user who calls `processExit()`
- **Exit Bond** The bond put up by the **Exit Initiator**
- **Process Exit Bounty** A portion of the **Exit Bond** that is given to the **Exit Processor** as a reward for processing the exit.
Whenever an exit is started, the **Exit Initiator** must put up an **Exit Bond**.
If the exit is proven to be invalid the entire **Exit Bond** is awarded to the **Challenger**.
If the exit is valid then after the challenge period it can be **processed** i.e. the funds returned to the **Exit Initiator**. A portion of the **Exit Bond**, called the **Process Exit Bounty**, is awarded to the **Exit Processor**. The remainder of the **Exit Bond** is returned to the **Exit Initiator**.
Note that the **Exit Initiator** can also be the **Exit Processor**.

## The Bond Life Cycle

### For Standard Exits

The **Exit Bond** is supplied by the **Exit Initiator** when starting an exit. Its main motivation is to disincentivize invalid exits, but in the case of a valid exit a portion of it is used to incentivize processing the exit by rewarding the **Exit Processor**.
The **Exit Initiator** should obtain the correct size of the Exit Bond by calling `startStandardExitBondSize()`.

**_After Starting an Exit:_**
*Bond -> from `Exit Initiator` to `Exit Game Contract`*

For an invalid exit, a challenge transfers the whole bond to the challenger. Non-exitable exits still remain in the exit queue and are deleted when the exits are processed. For a scenario where there are mutliple invalid exits in the queue, the processor is still awarded with some gas reward for deleting non-exitable exits from storage.

**_On succesfull challenge:_**
*Bond -> from `Exit Game Contract` to `Challenger`*

The **Exit Processor** gets the bounty as a reward for processing an exit. The cost of processing multiple exits from the exit queue at once is less than the cumulative cost of processing them individually. Since the **Process Exit Bounty** is given out for each exit processed, the **Exit Processor** can wait for the exit queue to stack up and then process multiple exits together to get a higher reward.

**_On processing exit:_**
*Bond - Bounty -> from `Exit Game Contract` to `Exit Initiator`*\
*Bounty -> from `Exit Game Contract` to `Exit processor`*

### For In-Flight Exits

The situation for in-flight exits is slightly different. Since the piggybacked inputs or outputs of an in-flight exit are exited separately, the **Exit Initiator** is the owner of the piggybacked input or output. In this case the **Exit Bond** is the Piggyback Bond that is put up when piggybacking and the **Process Exit Bounty** is taken from this. The size of the Piggyback Bond can be obtained by calling `piggybackBondSize()`.

**_After Piggybacking an input/output:_**
*Piggyback Bond -> from `Exit Initiator` to `Exit Game Contract`*

For any Input/Output spent challenge to the exit, the whole piggyback bond is transferred to the challenger. 

**_On succesfull challenge:_**
*Piggyback Bonds -> from `Exit Game Contract` to `Challenger`*

Both standard and in-flight exits are processed from the same exit queue and the **Process Exit Bounty** associated with each exit (or specifically each input/output) is awarded to the **Exit Processor**.

**_On processing exit:_**
*Bond - Bounty -> from `Exit Game Contract` to `Exit Initiator`*\
*Bounty -> from `Exit Game Contract` to `Exit processor`*

## Bond and Bounty Adjustment Mechanism


### The Updatable Structure

The Exit Bond follows an updatable pattern which allows it to be updated (by the maintainer) and reflect within a time period (2 days from the last update). The size of the Exit Bounty can also be updated as long as it is lower than (or equal) the Exit Bond Size and is within the upper/lower bounds. 

```
struct Params {
        uint128 previousBondSize;
        uint128 updatedBondSize;
        uint128 previousExitBountySize;
        uint128 updatedExitBountySize;
        uint128 effectiveUpdateTime;
        uint16 lowerBoundDivisor;
        uint16 upperBoundMultiplier;
    }

```

`Params` is a structure for storing the bond size:

1. `previousBondSize` reflects the bond size, if `now` < `effectiveUpdateTime`.
2. `updatedBondSize` field reflects the bond size, when when the effectiveUpdateTime period has passed and `now` > `effectiveUpdateTime`.
3. `previousExitBountySize` reflects the bounty size, if `now` < `effectiveUpdateTime`.
4. The `updatedExitBountySize` field reflects the bounty size, when the effectiveUpdateTime period has passed and `now` > `effectiveUpdateTime`.
5. The `effectiveUpdateTime` field denotes the timestamp at which the updated bond and bounty size should reflect and be put to use. The value of the timestamp is 2 days from the last update timestamp.
6. `lowerBoundDivisor` is a factor which limits the bond to be updated to a certain minimum
7. `upperBoundMultiplier` is a factor which limits the bond to be updated to a certain maximum

### Updating the Exit Bond and Bounty Size

#### Standard Exits

The current size of the Exit Bond can be retrieved by

```
function startStandardExitBondSize() public view returns (uint128) {
        return startStandardExitBond.bondSize();
    }
```

The Exit Bond Size along with the portion for Exit Bounty can be updated by the maintainer, as long as it is within the updatable bounds pre-specified. The updated bond and bounty size will only be effective after the `effectiveUpdateTime`.


```
function updateStartStandardExitBondSize(uint128 newBondSize, uint128 newExitBountySize) public onlyFrom(framework.getMaintainer()) {
        startStandardExitBond.updateBondSize(newBondSize, newExitBountySize);
        emit StandardExitBondUpdated(newBondSize);
    }
```

A thing to note here is that the `newBondSize` should always be greater than or equal to the `newExitBountySize`. For situations where the Exit Bounty size has to be updated to an amount which is higher than the existing Exit Bond size, update the Exit Bond size accordingly.
For cases, when you want to update only one of the two entities, pass in the previous size for the one you don't want to change.

#### In-Flight Exits

The current size of the In-flight Exit Bond can be retrieved by

```
function startIFEBondSize() public view returns (uint128) {
        return startIFEBond.bondSize();
    }
```

Since no portion from the IFE Bond is reserved for the Bounty the values of `previousExitBountySize` and `updatedExitBountySize` are unset. The IFE Bond size can be updated by 

```
function updateStartIFEBondSize(uint128 newBondSize) public onlyFrom(framework.getMaintainer()) {
        startIFEBond.updateBondSize(newBondSize, INITIAL_IFE_EXIT_BOUNTY_SIZE);
        emit IFEBondUpdated(newBondSize);
    }
```

The Piggyback Bond has a portion of it reserved for the Exit Bounty, since each piggybacked input/output can attempt to exit
The current size of the Piggyback Bond can be retrieved by

```
function piggybackBondSize() public view returns (uint128) {
        return piggybackBond.bondSize();
    }
```

The Piggyback Bond Size along with the Exit Bounty can be updated by the maintainer, as long as it is within the updatable bounds pre-specified. The updated bond and bounty size will only be effective after the `effectiveUpdateTime`

```
function updatePiggybackBondSize(uint128 newBondSize, uint128 newExitBountySize) public onlyFrom(framework.getMaintainer()) {
        piggybackBond.updateBondSize(newBondSize, newExitBountySize);
        emit PiggybackBondUpdated(newBondSize);
    }
```

### Bond Size Update Scenarios

Assume, the present conditions\
*Value of Exit Bond = B*\
*Value of Exit Bounty = C* (C <= B)

##### Exit Bond is updated after starting exit

1. Alice starts a SE with B
2. Bob starts a SE with B
3. The maintainer then updates Bond size to B' and Bounty size to C'
4. Processor processes exits from queue and gets C+C as a reward
5. Alice and Bob both get back (B - C) each

##### Exit Bond is updated between two exits, but started instantly

1. Alice starts a SE with B
2. The maintainer updates Bond size to B' and Bounty size to C'
3. Bob starts a SE within two days with B
4. Processor processes exits from queue and gets C+C as a reward
5. Alice and Bob both get back (B - C) each

##### Exit Bond is updated between two exits, but started after two days

1. Alice starts a SE with B
2. The maintainer updates Bond size to B' and Bounty size to C'
3. Bob starts a SE after two days with B'
4. Processor processes exits from queue and gets C+C' as a reward
5. Alice gets back (B - C) and Bob gets back (B' - C')

##### Exit Bond is updated again within effective period

1. Alice starts a SE with B
2. The maintainer updates PE Bounty to B' and Bounty size to C'
3. After one day, the maintainer updates the Bond size again to B" and Bounty size to C"
4. Then, after one day, Bob starts an SE with B
5. Processor processes exits from queue and gets C+C as a reward
6. Alice and Bob both get back (B - C) each

*Similarly for In-flight exits:*

##### Exit Bond is updated between Piggybacks

1. Alice spends an UTXO to Bob and Malorie
2. The exit is in-flight and Alice starts an IFE
3. Bob piggybacks an output with B
4. Then, the Piggyback Bond is updated to B' and Bounty to C'
5. After two days, Malorie piggybacks a different output with B'
6. Processor processes exits from queue and gets C+C' as a reward
7. Bob gets back (B - C) and Malorie gets back (B' - C')
