const { TezosToolkit, MichelCodecPacker } = require("@taquito/taquito")
const { InMemorySigner } = require("@taquito/signer")

const { migrate } = require("../scripts/helpers")

const storage = require("../storage/Token")
const aStorage = require("../storage/Achievements")

const owner = 'tz1ZCRre8PxLkxozRPcUne4C6ZUy4mqa51VC'

module.exports = async (tezos, network) => {

  tezos = new TezosToolkit(tezos.rpc.url)
  tezos.setPackerProvider(new MichelCodecPacker())
  const signer = await InMemorySigner.fromSecretKey(network.secretKey)
  const ADMIN = await signer.publicKeyHash()
  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: 90000,
    },
    signer,
  })

  console.log('Deploing FA2')
  storage.default.admin = owner
  const minteryAddress = await migrate(
    tezos,
    "Token",
    storage
  )
  console.log(`Token: ${minteryAddress}`)

  aStorage.default.admin = owner
  aStorage.default.token = minteryAddress

  console.log('Deploing Achievements contract')
  const crowdsaleAddress = await migrate(
    tezos,
    "Achievements",
    aStorage
  )
  console.log(`Achievements: ${crowdsaleAddress}`)
}
