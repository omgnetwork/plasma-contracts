# Process Exit Bounty Design

This document is a description of the current implementation of the Process Exit Bounty.

A Process Exit Bounty is a reward which is paid out to the `processExit()` initiator in return of the transaction cost borne by the person. The motive of having a bounty is to remove and extra step of processing exits while exiting funds. This also ensures everyone pays their share of processing contrary to passing on the responsibility to someone else.

## The Bounty Life Cycle

### For Standard Exits

With the addition of the process exit bounty, there is a requirement of paying the bounty in addition to the bond. The bounty attempts to approximately cover the cost of processing the exit and is put up as a reward for anyone who wishes to take up the task. The initiator/owner has to obtaint the correct size of the Process Exit Bounty by calling `processStandardExitBountySize()`

**_After Starting an Exit:_**
*Bond + Bounty funds -> from `Exit owner` to `Exit Game Contract`*

For an invalid exit, a challenge will transfer the bond and bounty to the challenger. The bounty here can be given away, since after a challange the exit will no longer be processed. Both exitable and non-exitable exits still remain in the exit queue and is deleted when the exits are processed, which awards the processor with some gas reward for deleting a non-exitable exit from storage.

**_On succesfull challenge:_**
*Bond + Bounty -> from `Exit Game Contract` to `Challenger`*

The user who processes an exit, gets the bounty reward for processing an exit. The cost of processing multiple exits from the exit queue at once could be of less cost than processing all those exits individually. However, the whole amount specified for each exit is given out as a bounty to the processor.

**_On processing exit:_**
*Bond -> from `Exit Game Contract` to `Exit owner`
Bounty -> from `Exit Game Contract` to `Exit processor`*

### For In-Flght Exits

The process exit bounty collection for in-flight exits is similar. However, for an in-flight exit it is necessary to pay the bounty while piggybacking an input/output. Since, only the piggybacked input/output from an in-flight exit can be exited. It only makes sense to obtain the bounty for each piggyback from the respective owner. The correct size of the bounty has to be obtained by calling `processInFlightExitBountySize()`

**_After Piggybacking an input/output:_**
*Piggyback Bond + Bounty funds -> from `I/O Owner` to `Exit Game Contract`*

For any Input/Output spent challenge to the exit, the bounty along with the piggyback bond is transferred to the challenger. For similar reasons, since the challenged input/output will not be exited, it is transferred to the challenger

**_On succesfull challenge:_**
*Piggyback Bonds + Bounty funds -> from `Exit Game Contract` to `Challenger`*

Both the standard and in-flight exit land on the same exit queue and the process exit bounty associated with each exit (or specifically each input/output) is awared to the processor.

**_On processing exit:_**
*Bond -> from `Exit Game Contract` to `I/O Owner`
Bounty -> from `Exit Game Contract` to `Exit processor`*

## Exit Bounty Updatable Structure

The Exit Bounty follows an updatable pattern which allows it to be updated (by the maintainer) and reflect within a time period (2 days from the last update)

```
struct Params {
    uint128 previousExitBountySize;
    uint128 updatedExitBountySize;
    uint128 effectiveUpdateTime;
    uint16 lowerBoundDivisor;
    uint16 upperBoundMultiplier;
}

```

`Params` is a structure for storing the bounty size:

1. `previousExitBountySize` reflects the bounty size, if `now` < `effectiveUpdateTime`.
2. The `updatedExitBountySize` field reflects the bounty size, when the effectiveUpdateTime period has passed and `now` > `effectiveUpdateTime`.
3. The `effectiveUpdateTime` field denotes the timestamp at which the updated bounty size should reflect and be put to use. The value of the timestamp is 2 days from the last update timestamp.
4. `lowerBoundDivisor` is a factor which limits the bounty to be updated to a certain lower bound
5. `upperBoundMultiplier` is a factor which limits the bounty to be updated to a certain upper bound

### Bounty Upgrade Mechanism

#### Process Standard Exit Bounty

The current size of the Process Exit Bounty can be retrieved by

```
 function processStandardExitBountySize() public view returns (uint128) {
        return processStandardExitBounty.exitBountySize();
    }
```

The Process Exit Bounty Size can be updated by the maintainer, as long as it is within the updatable bounds pre-specified. The updated bounty size will only be effective after the `effectiveUpdateTime`

```
function updateProcessStandardExitBountySize(uint128 newExitBountySize) public onlyFrom(framework.getMaintainer()) {
        processStandardExitBounty.updateExitBountySize(newExitBountySize);
        emit ProcessStandardExitBountyUpdated(newExitBountySize);
    }
```

#### Process In-Flight Exit Bounty

The current size of the Process Exit Bounty can be retrieved by

```
function processInFlightExitBountySize() public view returns (uint128) {
        return processIFEBounty.exitBountySize();
    }
```

The Process Exit Bounty Size can be updated by the maintainer, as long as it is within the updatable bounds pre-specified. The updated bounty size will only be effective after the `effectiveUpdateTime`

```
function updateProcessInFlightExitBountySize(uint128 newExitBountySize) public onlyFrom(framework.getMaintainer()) {
        processIFEBounty.updateExitBountySize(newExitBountySize);
        emit ProcessInFlightExitBountyUpdated(newExitBountySize);
    }
```

### Bounty Upgrade Scenarios

*Value of Process Exit Bounty = B*

##### PE Bounty is updated after starting exit

1. Alice starts a SE with B
2. Bob starts a SE with B
3. The maintainer then updates PE Bounty to B'
4. Processor processes exits from queue and gets B+B as a reward

##### PE Bounty is updated between two exits, but started instantly

1. Alice starts a SE with B
2. The maintainer updates PE Bounty to B'
3. Bob starts a SE within two days with B
4. Processor processes exits from queue and gets B+B as a reward

##### PE Bounty is updated between two exits, but started after two days

1. Alice starts a SE with B
2. The maintainer updates PE Bounty to B'
3. Bob starts a SE after two days with B'
4. Processor processes exits from queue and gets B+B' as a reward

##### PE Bounty is updated again within effective period

1. Alice starts a SE with B
2. The maintainer updates PE Bounty to B'
3. After one day, the maintainer updates the PE Bounty again to B"
4. Then, after one day, Bob starts an SE with B
5. Processor processes exits from queue and gets B+B as a reward

*Similarly for In-flight exits:*

##### PE Bounty is updated between Piggybacks

1. Alice spends an UTXO to Bob and Malorie
2. The exit is in-flight and Alice starts an IFE
3. Bob piggybacks the output with B
4. Then, the PE Bounty is updated to B'
5. After two days, Malorie piggybacks an output with B'
6. Processor processes exits from queue and gets B+B' as a reward
