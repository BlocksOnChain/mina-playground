import { Field, SmartContract, state, State, method, Reducer, PublicKey, Struct, PrivateKey, Bool, Gadgets, Provable, Poseidon } from 'o1js';



const adminPrivatekey = PrivateKey.fromBase58("EKEdDGiN9Zd9TaSPcNjs3nB6vs9JS3WCgdsrfyEeLcQpnXNR7j6E");
const adminPublicKey = adminPrivatekey.toPublicKey();

export class EligibleAddress extends Struct ({
  address: PublicKey,
  message: Field,
}) {


  constructor(address: PublicKey, message: Field) {
    super({ address, message });
    this.address = address;
    this.message = message;
  }
}

export class MinaChallange1 extends SmartContract {

  events = {
    'create-message': Field,
  };


  reducer = Reducer({ actionType: EligibleAddress });

  @state(Field) addressCounter = State<Field>();
  @state(Field) messageCounter = State<Field>();
  @state(PublicKey) admin = State<PublicKey>();

  @state(Field) actionAccountState = State<Field>();



  @method init() {
    super.init();
    this.addressCounter.set(Field(0));
    this.messageCounter.set(Field(0));
    this.admin.set(adminPrivatekey.toPublicKey());
    this.actionAccountState.set(Reducer.initialActionState);
  }

  private updateMessageCounter() {
    const currentState = this.messageCounter.getAndRequireEquals();
    const newState = currentState.add(1);
    this.messageCounter.set(newState);
  }

  private updateAddressCounter() {
    const currentState = this.addressCounter.getAndRequireEquals();
    const newState = currentState.add(1);
    this.addressCounter.set(newState);
  }


  @method addAddress(admin_priv: PrivateKey, address: PublicKey) {
    // Require admin signature
    admin_priv.toPublicKey().assertEquals(this.admin.getAndRequireEquals());
    // Dispatch field 0 to define address as eligible without creating message
    this.reducer.dispatch(new EligibleAddress(address, Field(0)));
    this.updateAddressCounter();
  }

  @method createMessage(user_priv: PrivateKey, message: Field) {
      this.checkIfAddressEligibleToMessage(user_priv.toPublicKey());
      let user_pub = user_priv.toPublicKey();
      let eligibleAddress = new EligibleAddress(user_pub, message);
      this.reducer.dispatch(eligibleAddress);
      this.emitEvent('create-message', message);
      this.updateMessageCounter();
    }

  @method checkIfAddressEligibleToMessage(address: PublicKey) {
    const actionAccountState = this.actionAccountState.getAndRequireEquals();
    let addedAddressesList = this.reducer.getActions({ fromActionState: actionAccountState });
    let initial = {
      state: Field(0),
      actionState: Reducer.initialActionState,
    };    // Check if address ever posted a message before
    let { state, actionState } = this.reducer.reduce(
      addedAddressesList,
      Field,
      (state: Field, action: EligibleAddress) => Provable.if(action.address.equals(address), state.add(1), state),
      initial,
      { skipActionStatePrecondition: true }
    );
    //Need only one record of address that is when we add the address to the list
    state.assertEquals(1, 'Address is not eligible to post message');
  }

  @method checkMessageFormat(message: Field) {
    let flags = message.toBits();
    let flag1 = flags[-6];
    let flag2 = flags[-5];
    let flag3 = flags[-4];
    let flag4 = flags[-3];
    let flag5 = flags[-2];
    let flag6 = flags[-1];

    if (flag1) {
      if (flag2 || flag3 || flag4 || flag5 || flag6) {
        throw new Error('Invalid message format: Rule 1');
      }
    }

    if (flag2) {
      if (!flag3) {
        throw new Error('Invalid message format: Rule 2');
      }
    }

    if (flag4) {
      if (flag5 || flag6) {
        throw new Error('Invalid message format: Rule 3');
      }
    }

    return true;
  }
}