# Important:

The package is for the Chainpont v4 Network. If you are looking to work with the older Chainpoint v3 Network (chainpoint-services), use version 1.6.1.

# Chainpoint CLI

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm](https://img.shields.io/npm/v/chainpoint-cli.svg)](https://www.npmjs.com/package/chainpoint-cli)

A Command Line Interface (CLI) for creating and verifying Chainpoint proofs. See https://chainpoint.org

The Chainpoint CLI lets you submit hashes to a Chainpoint Gateway on the Chainpoint Network. Gateways periodically aggregate hashes and send data to Chainpoint Core for anchoring the hash to public blockchains.

The CLI lets you retrieve and verify a Chainpoint proof. Each proof cryptographically proves the integrity and existence of data at a point in time.

The CLI also maintains a simple local database that keeps track of
every hash you submit, and stores and manages Chainpoint proofs
locally for easy retrieval, export, and verification.

The CLI includes an interface for interacting with a [Bitcoin Header Node](https://github.com/chainpoint/bitcoin-header-node)
which can be used for verifying btc anchors locally rather than relying on an external service.

## Installation

### Easy Install

Git tagged releases are automatically built as a single-file binary and uploaded as Github releases. Binaries are compiled for:

- Alpine Linux (x64)
- Linux (x64)
- macOS (x64)

You can find the most current releases at [https://github.com/chainpoint/chainpoint-cli/releases](https://github.com/chainpoint/chainpoint-cli/releases)

These binaries are created with the [pkg](https://github.com/zeit/pkg#readme) tool and have no pre-requisites. It is _not_ necessary to install even Node.js as it is packaged in the binary. Installation is a simple matter of downloading the appropriate file, giving it execute permissions, and running it from a location on your `PATH`.

#### Install & Run

```
$ npm install -g chainpoint-cli

$ chp
Usage: chp <command> [options] <argument>
...
```

## Usage

You can get an overview of the CLI usage by typing the command (`chp`). The Gateway that the CLI will
communicate with will be chosen from those advertised as healthy on the network.

On first use, the CLI will create a `~/.chainpoint/cli` directory
where it will store its `chainpoint-v4-proofs.db`
file. The database file will be managed for you and it is not recommended to
modify it yourself. The database stores a record of every hash
you submit, which Gateway it was submitted to, and a copy of the
proofs. You can create a `cli.config` file in this directory
with a `CHAINPOINT_GATEWAY_BASE_URI=` value if you'd like to
permanently specify a Gateway of your own choosing.

```
$ chp
Usage: chp <command> [options] <argument>

Commands:
  submit    submit a hash to be anchored
  update    retrieve an updated proof for your hash(es), if available
  verify    verify a proof's anchor claims
  evaluate  evaluate and display a proof's anchor claims
  export    export a proof
  list      display the status of every hash in the local database
  show      show the proof for a proof_id
  delete    delete a hash from the local database
  version   show the CLI version

Options:
  -g, --gateway-uri  specify uri of chainpoint gateway                      [string]
  -q, --quiet   suppress all non-error output                               [boolean]
  -j, --json    format all output as json                                   [boolean]
  -b, --btc     display btc specific information where applicable           [boolean]
  --help        show help                                                   [boolean]

You must specify a command.
```

### Submitting a hash

First you'll need to generate a hash of a local file or data
of your choice. We recommended using the [SHA256](https://en.wikipedia.org/wiki/SHA-2) one-way cryptographic hash function. Other hash types will also be accepted as long as they are hex strings between 40 and 128 hex characters (`[0-9a-fA-F]`) in length.

The Chainpoint Network only sees a hash of your data, never the
original. It is not possible for us to learn anything about your
data from the hash.

To submit a hash, simply call:

```
chp submit 2e75eaf17b8345c67234dfa92e867541ef41dda08baa6f8d5464fac432950794
52eb62c0-f556-11e7-bcf8-016fed1c55ad | 2e75eaf17b8345c67234dfa92e867541ef41dda08baa6f8d5464fac432950794 | submitted
```

The output returned consists of three parts:

The `proof_id` is `52eb62c0-f556-11e7-bcf8-016fed1c55ad` in this example. This type 1 UUID serves as a handle to retrieve a proof.

The original hash you submitted (`2e75eaf17b8345c67234dfa92e867541ef41dda08baa6f8d5464fac432950794`) is echoed back.

The action that occurred, `submitted` in this case, is returned.

You can also submit multiple hashes at once by calling `submit` with multiple hashes.

```
chp submit <hash> <hash> <hash>
```

### Updating a Proof

Once a hash has been submitted, it will first be anchored to the `Calendar` and a proof will be generated. A proof that anchors your hash to the Calendar is generally available within ten seconds or less.

```
chp update 52eb62c0-f556-11e7-bcf8-016fed1c55ad
52eb62c0-f556-11e7-bcf8-016fed1c55ad | updated | cal
```

You can see that you call `chp update` and just pass the `proof_id` as well.

You'll see echoed back to you the status, where the `cal` at the end indicates that the proof is anchored to the `Calendar`. Later you will see other blockchain anchors become available, such as `btc` to indicate that a
hash was anchored to the Bitcoin blockchain.

You can also call `chp update --all` to update all proofs locally stored.

### Verifying a Proof

Verifying a proof submits it to the Node for cryptographic verification that the hash captured in the proof is anchored all the way up to either the Calendar or to public blockchains. The Calendar contains all of the information needed to verify a proof.

```
chp verify 52eb62c0-f556-11e7-bcf8-016fed1c55ad
52eb62c0-f556-11e7-bcf8-016fed1c55ad | verified | cal
```

You can see here that the proof represented by the `proof_id` provided is anchored to the Calendar (`cal`) level.

### Viewing a Proof

You can of course view a proof in its entirety by asking
to see the proof associated with a `proof_id`.

```
chp --gateway-uri http://3.136.178.15 show 5e0433d0-46da-11ea-a79e-017f19452571 | jq

{
  "@context": "https://w3id.org/chainpoint/v4",
  "type": "Chainpoint",
  "hash": "ffff27222fe366d0b8988b7312c6ba60ee422418d92b62cdcb71fe2991ee7391",
  "proof_id": "5e0433d0-46da-11ea-a79e-017f19452571",
  "hash_received": "2020-02-03T23:10:28Z",
  "branches": [
    {
      "label": "aggregator",
      "ops": [],
      "branches": [
        {
          "label": "cal_anchor_branch",
          "ops": [
            {
              "l": "nistv2:1580771400:d5aa7ffdada5f6b9c6743ffd245c1d2b2ca32c68eca35576181c882f77cecda3a304d8ea4f9a0293831095187f6b5a0bfda1bd79d93da2badd45edf406b5691d"
            },
            {
              "op": "sha-256"
            },
            {
              "anchors": [
                {
                  "type": "tcal",
                  "anchor_id": "7159fe850b6ddb51ff50dc4d44b1aa363128e52ad49f21fd68b1cd0c77afa64d",
                  "uris": [
                    "http://3.135.54.225/calendar/7159fe850b6ddb51ff50dc4d44b1aa363128e52ad49f21fd68b1cd0c77afa64d/data"
                  ]
                }
              ]
            }
          ],
          "branches": [
            {
              "label": "btc_anchor_branch",
              "ops": [
                {
                  "r": "f472ed9ff3018dfd499d7b2cd8f1fc7905c4b7204bac2bd7050b153391987ca6"
                },
                {
                  "op": "sha-256"
                },
                {
                  "l": "ba707b57f9eadb627d9393417df9b28e382ad9efec15e48ecc8d96fa87ba2079"
                },
                {
                  "op": "sha-256"
                },
                {
                  "l": "0100000001161056cfe33bb565f50cff84e30b5d14720d4a7172ab246be96f3d28ba22b8810000000000ffffffff020000000000000000226a20"
                },
                {
                  "r": "08e0ee0500000000160014a2ae5c0fec0e93b33d25909f42b24877376d25cc00000000"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "l": "7cac66fad58fb08cacd6776a8a0809d9021fcebe2d5c0213c896efceda5bf36a"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "l": "30da4ce3b26c504efbea5fb9f4b2ec8f90e813903d60571fe66a0024f3cd8bf9"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "d2fb192142c66f660fe90289f3348e359d77961f74eec41c0dc4b807bbc2b91e"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "43272a988b0fadf0c1bcebed5fd7e9bd7997e42fa8f363ca319a150ec70b24d4"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "83dc9a9f490a8590bd7e213b9e4383be3f7b31e23d54c811aca00fe4eec9f939"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "272e88bfa321f02d2b4c1a16b71daa04048cb643fc4b8b6b581488f0b6a9845f"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "7eeb158ac9fdec5b3c69b0218eeb2632a1e77307197f159499d195fae34756f8"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "d05416db085e08e0bfd3bdad3195f1e94d49db825007c662777d825d37951c56"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "r": "a1db66df5ca62af0c0fc5bcd28116b4d2d4a47f8c18a9fe08209cb358fba0f6c"
                },
                {
                  "op": "sha-256-x2"
                },
                {
                  "anchors": [
                    {
                      "type": "tbtc",
                      "anchor_id": "1664848",
                      "uris": [
                        "http://3.135.54.225/calendar/1eedc4483110bc656cf21e39a8b77041798ef49b8b0a5cd266f3060d81087fb7/data"
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

You can see in this case I piped the output of the `show` sub-command to the `jq` program. This is just for viewing convenience so we can see the pretty-printed version of the proof.

### Evaluating a proof

`evaluate <hash_id>` calculates and displays the expected values for each anchor in the proof.
Adding `--btc` or `-b` will return the txid of the anchor transaction.

```
chp evaluate b640f9f0-3661-11e9-9c57-018b108544a2

b640f9f0-3661-11e9-9c57-018b108544a2 | cal | 2755298 | ab1dc08a1950ade9d4d603c90d655307eb765905148f6e18eddeb64ca241b7b4
b640f9f0-3661-11e9-9c57-018b108544a2 | btc | 564116 | af81bc00748ed3beab4f08ad16b33bb88aefdc0a283eb4446cf8d83b38ea7133 | 7cdcefb56c2ec3230b2edb2ff5d1adf4a8acf4525850e1f0248b803cfe96dd02

```

### Other commands

`list` will show you a list of all hash IDs and hashes that have been submitted from this CLI client.

`export` allows you to export a proof in either JSON or binary file formats.

`delete <hash_id>` allows you to manually delete any hash from your local DB.

You can also get JSON output by passing in the `--json` flag. For example:

```
chp verify --json 52eb62c0-f556-11e7-bcf8-016fed1c55ad
```

### Interacting with a Bitcoin Header Node (BHN)

Following the `chp` command with `bhn` will pass along any commands and options to the Bitcoin Header Node Interface.
All data associated the instance of bhn is stored by default in the `/.chainpoint/bhn` data directory. As with the
primary `chp` command, you can see a list of `bhn` options by simply typing `chp bhn`

```
$ chp bhn

Usage: bhn <command> [options...]

Commands:
  chp bhn execute <method>          fire an arbitrary rpc method to
  [options..]                          the bitcoin header node. e.g.
                                       `chp bhn execute getpeerinfo`
  chp bhn get <block-height>        get the header for a block at a
  [header node options...]             certai block. Must point to a
                                       running bhn server
  chp bhn info [header node         get info about a bitcoin header
  options...]                          node. With no options set it
                                       will check locally and indicate
                                       if none is running
  chp bhn start [header node        start a bitcoin header node
  options...]                          locally
  chp bhn stop [header node         stop a bitcoin header node
  options...]

Options:
  --version       Show version number                         [boolean]
  -g, --gateway-uri  specify uri of chainpoint gateway        [string]
  -q, --quiet     suppress all non-error output               [boolean]
  -j, --json      format all output as json                   [boolean]
  --bhn-uri       full uri of bitcoin header node. If no port is given,
                  assumed default RPC port for Bitcoin Mainnet (8332)
  --bhn-api-key   api key if target node requires authentication
  --bhn-host      host of target bitcoin header node
                                                 [default: "localhost"]
  --bhn-port      port of target bitcoin header node if different from
                  default bitcoin RPC port
  --bhn-network   Bitcoin network the target node is running on. This
                  option is useful if want to target default ports.
                  (--network also works)              [default: "main"]
  --bhn-protocol  protocol where target bitcoin header node is running
                                                     [default: "http:"]
  --help          Show help                                   [boolean]

```

### Starting BHN

Before you can verify btc anchors locally, you need to sync up a bhn node.
By default a mainnet node will be started with no api key, and at the Chainpoint starting height
of Block #337022. All of these can be customized with the above options.

```bash
$ chp bhn start
```

Your terminal will output the connection configuration for your node and prompt for a confirmation
before starting up. Note that bhn currently takes up the current process and you will need to open another
terminal session to interact with it.

### Proof verification against local node

Local verification happens automatically if you have a node already running.
Note that you shouldn't pass the `bhn` prefix for this, just make sure to pass in any
necessary connection configs such as API key or host information when running the `verify` command.
You can even verify against a node you have running remotely and will work against normal bcoin Full or
SPV Nodes too.

If no node matching the configs can be connected to, then the CLI will fallback to using Chainpoint Gateways.

```bash
$ chp verify -a
```

### Other interactions

Here are some other useful commands you can run in another terminal window once your node is running

To get running info of your node, including sync status:

```bash
$ chp bhn info
```

To get a block header at a specific height:

```bash
$ chp bhn get 500000
```

To execute arbitrary rpc commands:

```bash
# this gets the block your node started syncing from
$ chp bhn execute getstartheader
# and this gets information about the peers you're connected to
$ chp bhn execute getpeerinfo
```

Check out the [bcoin api documentation](http://bcoin.io/api-docs/index.html#rpc-calls-node)
for more avaialable RPC commands.

### Help

You should note that each of the sub-commands also has its own help screen.

```
$ chp submit --help
Usage: submit [options] (<hash> <hash>... | <hash>,<hash>,... )

Options:
  -g, --gateway-uri  specify uri of chainpoint gateay
                                  [string] [default: "http://GATEWAY_URI"]
  -q, --quiet   suppress all non-error output                          [boolean]
  -j, --json    format all output as json                              [boolean]
  --help        show help                                              [boolean]
```
