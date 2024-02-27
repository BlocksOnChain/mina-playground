import {
    Field,
    SmartContract,
    state,
    State,
    method,
    Reducer,
    PublicKey,
    Struct,
    PrivateKey,
    Bool,
    Gadgets,
    Provable,
    Poseidon,
    ZkProgram,
    SelfProof,
} from 'o1js';

export class Message extends Struct({
    messageNumber: Field,
    agentID: Field,
    xLocation: Field,
    yLocation: Field,
    checkSum: Field,
}) {
    constructor(
        messageNumber: Field,
        agentID: Field,
        xLocation: Field,
        yLocation: Field,
        checkSum: Field
    ) {
        super({ messageNumber, agentID, xLocation, yLocation, checkSum });
        this.messageNumber = messageNumber;
        this.agentID = agentID;
        this.xLocation = xLocation;
        this.yLocation = yLocation;
        this.checkSum = checkSum;
    }

    isValid() {
        return this.agentID
            .greaterThan(Field(0))
            .and(this.agentID.lessThanOrEqual(Field(3000)))
            .and(this.xLocation.greaterThanOrEqual(Field(0)))
            .and(this.xLocation.lessThanOrEqual(Field(15000)))
            .and(this.yLocation.greaterThanOrEqual(Field(5000)))
            .and(this.yLocation.lessThanOrEqual(Field(20000)))
            .and(this.yLocation.greaterThan(this.xLocation))
            .and(
                this.checkSum.equals(
                    this.agentID.add(this.xLocation).add(this.yLocation)
                )
            );
    }
}

export const BatchMessageVerifier = ZkProgram({
    name: 'batch-message-verifier',
    publicInput: Field,
    publicOutput: Field,
    methods: {
        baseCase: {
            privateInputs: [],
            method(publicInput: Field): Field {
                publicInput.assertEquals(Field(0));
                return publicInput;
            },
        },
        newMessage: {
            privateInputs: [SelfProof, Message],
            method(publicInput: Field, earlierProof: SelfProof<Field, Field>, message: Message): Field {
                // If Agent ID is zero, no need to check other values
                earlierProof.verify();
                return Provable.if(
                    (message.agentID.equals(Field(0))).or(message.isValid()),
                    Provable.if(
                        message.messageNumber.greaterThan(earlierProof.publicOutput),
                        message.messageNumber,
                        publicInput
                    ),
                    publicInput
                );  
            },
        },
    },
});

await BatchMessageVerifier.compile();

class BatchMessageVerifierProof extends ZkProgram.Proof(BatchMessageVerifier) {}


export class MinaChallenge2 extends SmartContract {
    @state(Field) highestMessageNumber = State<Field>();

    @method init() {
        super.init();
        this.highestMessageNumber.set(Field(0));
    }

    @method verifyBatchMessagesWithProof(proof: BatchMessageVerifierProof) {
        BatchMessageVerifier.verify(proof);
        this.highestMessageNumber.getAndRequireEquals();
        this.highestMessageNumber.set(proof.publicOutput);
    }
}
