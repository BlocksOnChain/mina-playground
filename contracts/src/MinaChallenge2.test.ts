import { MinaChallenge2, BatchMessageVerifier, Message } from './MinaChallange2';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';


let proofsEnabled = false;
describe('MinaChallenge2', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: MinaChallenge2;

  beforeAll(async () => {
    if (proofsEnabled) await MinaChallenge2.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new MinaChallenge2(zkAppAddress);
  });
/*
message number
Agent ID (should be between 0 and 3000)
Agent XLocation (should be between 0 and
15000)
Agent YLocation (should be between 5000 and
20000)
CheckSum
CheckSum is the sum of Agent ID , Agent XLocation ,
and Agent YLocation
the 4 message details numbers are in the correct
range
Agent YLocation should be greater than Agent
XLocation
*/
  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `MinaChallenge2` smart contract', async () => {
    await localDeploy();
  });
  it('Batches new messages into the `MinaChallenge2` smart contract', async () => {
    await localDeploy();
    let proof = await BatchMessageVerifier.baseCase(Field(0));
    let messages = [];
    // This message should be saved because AgentID is 0
    messages.push(new Message(
      Field(10),
      Field(4),
      Field(2000),
      Field(8000),
      Field(10004)
    ));
// Wrong checksum but passes the other checks because the AgentID is 0.
    messages.push(new Message(
      Field(16),
      Field(0),
      Field(2000),
      Field(8000),
      Field(10002)
    ));
    messages.push(new Message(
      Field(12),
      Field(9),
      Field(2000),
      Field(8000),
      Field(10009)
    ));

    messages.push(new Message(
      Field(14),
      Field(3),
      Field(2000),
      Field(8000),
      Field(10003)
    ));
    // This message should not be saved because locationY is lesser than 5000
    messages.push(new Message(
      Field(18),
      Field(1),
      Field(2000),
      Field(4000),
      Field(10001)
    ));
    // This message should not be saved because checkSum is wrong
    messages.push(new Message(
      Field(19),
      Field(5),
      Field(2000),
      Field(8000),
      Field(10002)
    ));
    // This message should not be saved because locationX is greater than locationY
    messages.push(new Message(
      Field(20),
      Field(2),
      Field(10000),
      Field(8000),
      Field(18002)
    ));
    for(let i = 0; i < messages.length; i++) {
      proof = await BatchMessageVerifier.newMessage(proof.publicOutput, proof, messages[i]);
    }
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.verifyBatchMessagesWithProof(proof);
    });
    await txn.prove();
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
    const highestMessageNumber = zkApp.highestMessageNumber.get()
    expect(highestMessageNumber.value[1].toString().slice(2)).toEqual("16");
  });

  it("Batches new messages that is not valid and unique ", async () => {
    await localDeploy();
    let proof = await BatchMessageVerifier.baseCase(Field(0));
    let messages = [];
    messages.push(new Message(
      Field(13),
      Field(3),
      Field(2000),
      Field(8000),
      Field(10003)
    ));
    for(let i = 0; i < 15; i++) {
      messages.push(new Message(
        Field(i),
        Field(0),
        Field(2000),
        Field(8000),
        Field(10002)
      ));
    }
    for(let i = 0; i < messages.length; i++) {
      proof = await BatchMessageVerifier.newMessage(proof.publicOutput, proof, messages[i]);
    }
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.verifyBatchMessagesWithProof(proof);
    });
    await txn.prove();
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
    const highestMessageNumber = zkApp.highestMessageNumber.get()
    expect(highestMessageNumber.value[1].toString().slice(2)).toEqual("14");
  });
});
