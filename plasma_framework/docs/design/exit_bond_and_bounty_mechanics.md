# Exit Bond and Bounty Mechanics

This document is a description of the current implementation of exit bonds and process exit bounties which are an integral part of the exit mechanism.

A Process Exit Bounty is a reward which is paid out to the `processExit()` initiator to compensate for the transaction cost. The motive of having a bounty is to remove an extra step of processing exits while exiting funds. This also ensures everyone pays their share of processing contrary to passing on the responsibility to someone else.

The Exit Bounty is paid out as a portion (or whole) of the Exit Bond and the size of the Bond is designed to ideally cover both the cost of challenging an invalid exit or the cost of processing a valid exit 

## The Bond Life Cycle

### For Standard Exits

The Bond is supplied by the Output owner while starting an exit and the main motive is to disincentivize invalid exits while also being able to use a portion of the bond to incentivize processing exits. The Bond is internally divided into two portions. For successful exits, one of them can be returned to the output owner, and the other is a reward for processing the exit.
The initiator/owner has to obtaint the correct size of the Exit Bond by calling `startStandardExitBondSize()`.

**_After Starting an Exit:_**
*Bond -> from `Exit owner` to `Exit Game Contract`*

For an invalid exit, a challenge will transfer the whole bond to the challenger. Both exitable and non-exitable exits still remain in the exit queue and is deleted when the exits are processed. For a scenario where there are mutliple invalid exits in the queue, the processor is still awarded with some gas reward for deleting non-exitable exits from storage.

**_On succesfull challenge:_**
*Bond -> from `Exit Game Contract` to `Challenger`*

The user who processes an exit, gets the bounty reward for processing an exit. The cost of processing multiple exits from the exit queue at once could be of less cost than processing all those exits individually. However, the bounty amount associated with each exit is given out to the processor.

**_On processing exit:_**
*Bond - Bounty -> from `Exit Game Contract` to `Exit owner`*\
*Bounty -> from `Exit Game Contract` to `Exit processor`*

### For In-Flght Exits

The Bond/Bounty collection for in-flight exits is similar. However, for an in-flight exit, the Exit Bounty is a poriton of the Piggyback Bond. Since only the piggybacked input/output from an in-flight exit can be exited, it only makes sense to have the bounty for each piggyback from the respective owner. The size of the Piggyback Bond can be obtained by calling `piggybackBondSize()`.

**_After Piggybacking an input/output:_**
*Piggyback Bond -> from `I/O Owner` to `Exit Game Contract`*

For any Input/Output spent challenge to the exit, the whole piggyback bond is transferred to the challenger. 

**_On succesfull challenge:_**
*Piggyback Bonds -> from `Exit Game Contract` to `Challenger`*

Both the standard and in-flight exit land on the same exit queue and the process exit bounty associated with each exit (or specifically each input/output) is awarded to the processor.

**_On processing exit:_**
*Bond - Bounty -> from `Exit Game Contract` to `I/O Owner`*\
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

The current size of the In-flight Exit Bond can be retreived by

```
function startIFEBondSize() public view returns (uint128) {
        return startIFEBond.bondSize();
    }
```

Since no portion from the IFE Bond is reserved for the Bounty the values of `previousExitBountySize` and `updatedExitBountySize` are unset. The IFE Bond size can be updated by 

```
function updateStartIFEBondSize(uint128 newBondSize) public onlyFrom(framework.getMaintainer()) {
        startIFEBond.updateBondSize(newBondSize, 0);
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
3. Bob piggybacks the output with B
4. Then, the Piggyback Bond is updated to B' and Bounty to C'
5. After two days, Malorie piggybacks an output with B'
6. Processor processes exits from queue and gets C+C' as a reward
7. Bob gets back (B - C) and Malorie gets back (B' - C')
