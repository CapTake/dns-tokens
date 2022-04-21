import { MichelsonMap } from "@taquito/michelson-encoder";
import { char2Bytes } from '@taquito/utils'

import { zeroAddress } from "../test/helpers/Utils";

const metadata = new MichelsonMap();
metadata.set('', char2Bytes('tezos-storage:contents'));
metadata.set('contents', char2Bytes(JSON.stringify({
    version: '1.0',
    name: 'DNS Achievements',
    authors: ['Boris Grit <salv@protonmail.com>'],
    description: 'Tokens for the DNS',
    homepage: 'https://dns.xyz',
    interfaces: ['TZIP-012','TZIP-016']
})))

export default {
    admin: zeroAddress,
    extra: new MichelsonMap(),
    last_id: 0,
    ledger: new MichelsonMap(),
    metadata,
    pending_admin: null,
    signer: 'edpku9qEgcyfNNDK6EpMvu5SqXDqWRLuxdMxdyH12ivTUuB1KXfGP4', // carol
    token: zeroAddress,
    token_metadata: new MichelsonMap(),
}
