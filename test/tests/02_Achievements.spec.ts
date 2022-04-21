import { TezosToolkit, MichelsonMap, MichelCodecPacker } from "@taquito/taquito";
import { packDataBytes } from "@taquito/michel-codec"
import { InMemorySigner } from "@taquito/signer";
import { char2Bytes } from "@taquito/utils";
import minteryContractJson from "../../build/Token.json";
import achiContractJson from "../../build/Achievements.json";
import chai, { expect } from "chai";
import { rejects } from "assert";
import { MichelsonMapKey } from "@taquito/michelson-encoder";

// jest.setTimeout(50000);

const alice = {
  pkh: "tz1MnmtP4uAcgMpeZN6JtyziXeFqqwQG6yn6",
  sk: "edsk3Sb16jcx9KrgMDsbZDmKnuN11v4AbTtPBgBSBTqYftd8Cq3i1e",
  pk: "edpku9qEgcyfNNDK6EpMvu5SqXDqWRLuxdMxdyH12ivTUuB1KXfGP4",
};
const bob = {
  pk: "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
  pkh: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
  sk: "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt"
};
const carol = {
    pkh: "tz1MnmtP4uAcgMpeZN6JtyziXeFqqwQG6yn6",
    sk: "edsk3Sb16jcx9KrgMDsbZDmKnuN11v4AbTtPBgBSBTqYftd8Cq3i1e",
    pk: "edpku9qEgcyfNNDK6EpMvu5SqXDqWRLuxdMxdyH12ivTUuB1KXfGP4",
};

const price = 1;
const rpcUrl = "https://rpc.ithacanet.teztnets.xyz";

const error_ACCESS_DENIED = "Access denied"
const error_NOT_STARTED = "11"
const error_RESERVE_EXHAUSTED = "12"
const error_NOT_WHITELISTED = "13"
const error_AMOUNT_TOO_BIG = "14"
const error_WALLET_ALLOWANCE_EXCEEDED = "15"
const error_PAUSED = "16"
const error_INCORRECT_FUNDS_AMOUNT = "17"

let contractAddress = "";
let TezosAlice;
let TezosBob;
let aliceSigner;
let bobSigner;
let achiAddress = ""
let TezosCarol;
let carolSigner;

before("setup", async () => {
  // sets up the Tezos toolkit instance with Alice as a signer
  TezosAlice = new TezosToolkit(rpcUrl);
  aliceSigner = new InMemorySigner(alice.sk);
  TezosAlice.setSignerProvider(aliceSigner);
  TezosAlice.setPackerProvider(new MichelCodecPacker())
  // sets up the Tezos toolkit instance with Bob as a signer
  TezosBob = new TezosToolkit(rpcUrl);
  bobSigner = new InMemorySigner(bob.sk);
  TezosBob.setSignerProvider(bobSigner);
  TezosBob.setPackerProvider(new MichelCodecPacker())
  TezosCarol = new TezosToolkit(rpcUrl);
  carolSigner = new InMemorySigner(carol.sk);
  TezosCarol.setSignerProvider(carolSigner);
  TezosCarol.setPackerProvider(new MichelCodecPacker());
});
if (!achiAddress) {
describe("Origination of contract", () => {
  it("Should originate the FA2 contract", async () => {
    try {
      const originationOp = await TezosAlice.contract.originate({
        code: minteryContractJson.michelson,
        storage: {
          admin: alice.pkh,
          pending_admin: null,
          ledger: MichelsonMap.fromLiteral({
            [alice.pkh]: 1000,
          }),
          metadata: new MichelsonMap(),
          operators: new MichelsonMap(),
          token_metadata: new MichelsonMap(),
        }
      });
      await originationOp.confirmation();
      contractAddress = originationOp.contractAddress;
      expect(originationOp.hash).to.be.a('string');
      expect(contractAddress).to.be.a('string');
    } catch (error) {
      // console.error(error);
      expect(error).to.be.undefined;
    }
  });

  it("Should originate the Achievements contract", async () => {
    try {
      const originationOp = await TezosAlice.contract.originate({
        code: achiContractJson.michelson,
        storage: {
            admin: alice.pkh,
            token: contractAddress,
            metadata: new MichelsonMap(),
            last_id: 0,
            extra: new MichelsonMap(),
            ledger: new MichelsonMap(),
            pending_admin: null,
            signer: carol.pk,
            token_metadata: new MichelsonMap(),
        }

      });
      await originationOp.confirmation();
      achiAddress = originationOp.contractAddress;
      expect(originationOp.hash).to.be.a('string');
      expect(achiAddress).to.be.a('string');
      // console.log(achiAddress)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
});
}

describe("Tests for minting", () => {

    it("Should prevent Bob from minting a token", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            await rejects(contract.methods
                .create_achievement(MichelsonMap.fromLiteral({ "": char2Bytes("TEST METADATA") }), 1000)
                .send(), (err: Error) => {
                    expect(err.message).to.equal(error_ACCESS_DENIED);
                    return true;
                });
            } catch (error) {
                console.error(error);
                expect(error).to.be.undefined;
            }
    });

    it("Should allow admin Alice to mint token", async () => {
        try {
            const contract = await TezosAlice.contract.at(achiAddress);
            const op = await contract.methods.create_achievement(MichelsonMap.fromLiteral({ "": char2Bytes("TEST METADATA") }), 1000).send();
            await op.confirmation(1);
        
        const newStorage = await contract.storage();
        expect(newStorage.last_id.toNumber()).to.equal(1)
        const tokenmeta = await newStorage.token_metadata.get(0)
        console.log(tokenmeta)
    } catch (error) {
        console.error(error);
        expect(error).to.be.undefined;
    }})

    it("Should allow admin Alice to transfer tokens to Achievements contract", async () => {
        try {
            const contract = await TezosAlice.contract.at(contractAddress);
            const storage = await contract.storage();
            const aliceOriginalBalance = await storage.ledger.get(alice.pkh);
            expect(aliceOriginalBalance.toNumber()).to.equal(1000);
            const op = await contract.methods
              .transfer([
                {
                  from_: alice.pkh,
                  txs: [{ to_: achiAddress, token_id: 0, amount: aliceOriginalBalance }]
                }
              ])
              .send();
            await op.confirmation(1);
        
            const balance = await storage.ledger.get(achiAddress);
            expect(balance.toNumber()).to.equal(1000)
        } catch (error) {
            console.error(error);
            expect(error).to.be.undefined;
        }
    })

    it("Should allow Bob to claim Achievement", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            const { bytes } = await packDataBytes(
                [{ int: 1 }, { string: bob.pkh }],
                { prim: "pair", args: [{ prim: "nat"}, {prim: "address"}] }
              );
            const { sig } = await carolSigner.sign(bytes)

            const op = await contract.methods.claim_achievement(bytes, sig).send();
            await op.confirmation(1);
            const newStorage = await contract.storage();
            const minted = await newStorage.ledger.get({ 0: bob.pkh, 1: 1})
            expect(minted.toNumber()).to.equal(1)
        } catch (error) {
            console.error(error);
            expect(error).to.be.undefined;
        }
    })

    it("Should prevent Bob from claiming same Achievement", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            const { bytes } = await packDataBytes(
                [{ int: 1 }, { string: bob.pkh }],
                { prim: "pair", args: [{ prim: "nat"}, {prim: "address"}] }
              );
            const { sig } = await carolSigner.sign(bytes)
            await rejects(contract.methods.claim_achievement(bytes, sig).send(), (err: Error) => {
                expect(err.message).to.equal("Achievement already unlocked");
                return true;
            });
        } catch (error) {
            // console.error(error);
            expect(error).to.be.undefined;
        }
    })
});

describe("Tests for administering", () => {
    it("Should allow Alice to set Bob as admin", async () => {
        try {
            const contract = await TezosAlice.contract.at(achiAddress);
            const op = await contract.methods.set_admin(bob.pkh).send()
            await op.confirmation(1)
            const newStorage = await contract.storage()
            expect(newStorage.pending_admin).to.equal(bob.pkh)
        } catch (error) {
            // console.error(error);
            expect(error).to.be.undefined;
        }
    })
    it("Should allow Bob become admin", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            const op = await contract.methods.confirm_admin().send()
            await op.confirmation(1)
            const newStorage = await contract.storage()
            expect(newStorage.admin).to.equal(bob.pkh)
        } catch (error) {
            // console.error(error);
            expect(error).to.be.undefined;
        }
    })
    it("Should allow Bob to disable Achievement", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            const op = await contract.methods.enable_achievement(1, false).send()
            await op.confirmation(1)
            const newStorage = await contract.storage()
            const { enable } = await newStorage.extra.get(1)
            expect(enable).to.be.false
        } catch (error) {
            // console.error(error);
            expect(error).to.be.undefined;
        }
    })
    it("Should prevent Alice from claiming disabled Achievement", async () => {
        try {
            const contract = await TezosAlice.contract.at(achiAddress);
            const { bytes } = await packDataBytes(
                [{ int: 1 }, { string: alice.pkh }],
                { prim: "pair", args: [{ prim: "nat"}, {prim: "address"}] }
              );
            const { sig } = await carolSigner.sign(bytes)
            await rejects(contract.methods.claim_achievement(bytes, sig).send(), (err: Error) => {
                expect(err.message).to.equal("Achievement disabled");
                return true;
            })
        } catch (error) {
            // console.error(error);
            expect(error).to.be.undefined;
        }
    })
})
describe("Test for token metadata", () => {
    it("Should allow Bob to update token metadata", async () => {
        try {
            const contract = await TezosBob.contract.at(achiAddress);
            const newStorage = await contract.storage()
            const uri = 'ipfs://zdj7WkPvrxL7VxiWbjBP5rfshPtAzXwZ77uvZhfSAoHDeb3iw/1'
            const id = newStorage.last_id.toNumber()

            const op = await contract.methods.update_token_metadata(MichelsonMap.fromLiteral({"" : char2Bytes(uri)}), id).send()
            await op.confirmation(1)
            const storage = await contract.storage()
            const tokenMeta = await storage.token_metadata.get(id)
            expect(tokenMeta.token_id.toNumber()).to.equal(id)
            expect(tokenMeta.token_info.get("")).to.equal(char2Bytes(uri))
        } catch (error) {
            console.error(error);
            expect(error).to.be.undefined;
        }
    })
})
