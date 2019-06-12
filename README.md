# Chainpoint CLI

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Build Status](https://travis-ci.org/chainpoint/chainpoint-cli.svg?branch=master)](https://travis-ci.org/chainpoint/chainpoint-cli)
[![npm](https://img.shields.io/npm/l/chainpoint-cli.svg)](https://www.npmjs.com/package/chainpoint-cli)
[![npm](https://img.shields.io/npm/v/chainpoint-cli.svg)](https://www.npmjs.com/package/chainpoint-cli)

A Command Line Interface (CLI) for creating and verifying Chainpoint proofs. See https://chainpoint.org

The Chainpoint CLI lets you submit hashes to a Chainpoint Node on the Chainpoint Network. Nodes periodically aggregate hashes and send data to Chainpoint Core for anchoring the hash to public blockchains.

The CLI lets you retrieve and verify a Chainpoint proof. Each proof cryptographically proves the integrity and existence of data at a point in time.

The CLI also maintains a simple local database that keeps track of
every hash you submit, and stores and manages Chainpoint proofs
locally for easy retrieval, export, and verification.

The CLI includes an interface for interacting with a [Bitcoin Header Node](https://github.com/chainpoint/bitcoin-header-node)
which can be used for verifying btc anchors locally rather than relying on an external service.

## Backwards Incompatible Changes for V2

- cli arg for passing a custom node server was changed from `--server` and `-s` to `--node-uri` and `-n`.
  Use `chp --help` for more info
- To pass connection configs for a bitcoin header node (bhn), preface with a `--bhn-`, e.g. `--bhn-uri`, `--bhn-port`, or `--bhn-api-key`
- Submissions and verifications now happen on the new Chainpoint network. If you would like to use the CLI
  for verifying older proofs, please downgrade to v1.x.x of the CLI

## Installation

### Easy Install

Git tagged releases are automatically built as a single-file binary and uploaded as Github releases. Binaries are compiled for:

- Alpine Linux (x64)
- Linux (x64)
- Linux (x86)
- macOS (x64)

You can find the most current releases at [https://github.com/chainpoint/chainpoint-cli/releases](https://github.com/chainpoint/chainpoint-cli/releases)

These binaries are created with the [pkg](https://github.com/zeit/pkg#readme) tool and have no pre-requisites. It is _not_ necessary to install even Node.js as it is packaged in the binary. Installation is a simple matter of downloading the appropriate file, giving it execute permissions, and running it from a location on your `PATH`.

Install & Run

```
$ wget https://github.com/chainpoint/chainpoint-cli/releases/download/v1.4.6/chainpoint-cli-macos-x64 -O chp && chmod 755 chp

$ ./chp
Usage: chp <command> [options] <argument>
...
```

## Usage

You can get an overview of the CLI usage by typing the command (`chp`). The Node that the CLI will
communicate with will be chosen from those advertised as healthy on the network.

On first use, the CLI will create a `~/.chainpoint/cli` directory
where it will store its `chainpoint-proofs.db`
file. The database file will be managed for you and it is not recommended to
modify it yourself. The database stores a record of every hash
you submit, which Node it was submitted to, and a copy of the
proofs. You can create a `cli.config` file in this directory
with a `CHAINPOINT_NODE_API_BASE_URI=` value if you'd like to
permanently specify a Node of your own choosing.

```
$ chp
Usage: chp <command> [options] <argument>

Commands:
  submit    submit a hash to be anchored (3x Nodes default)
  update    retrieve an updated proof for your hash(es), if available
  verify    verify a proof's anchor claims
  evaluate  evaluate and display a proof's anchor claims
  export    export a proof
  list      display the status of every hash in the local database
  show      show the proof for a hash_id_node
  delete    delete a hash from the local database
  version   show the CLI version

Options:
  -n, --node-uri  specify uri of chainpoint node [string] [default: "http://0.0.0.0"]
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

The `node_hash_id` is `52eb62c0-f556-11e7-bcf8-016fed1c55ad` in this example. This type 1 UUID serves as a handle to retrieve a proof.

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

You can see that you call `chp update` and just pass the `node_hash_id` as well.

You'll see echoed back to you the status, where the `cal` at the end indicates that the proof is anchored to the `Calendar`. Later you will see other blockchain anchors become available, such as `btc` to indicate that a
hash was anchored to the Bitcoin blockchain.

You can also call `chp update --all` to update all proofs locally stored.

### Verifying a Proof

Verifying a proof submits it to the Node for cryptographic verification that the hash captured in the proof is anchored all the way up to either the Calendar or to public blockchains. The Calendar contains all of the information needed to verify a proof.

```
chp verify 52eb62c0-f556-11e7-bcf8-016fed1c55ad
52eb62c0-f556-11e7-bcf8-016fed1c55ad | verified | cal
```

You can see here that the proof represented by the `node_hash_id` provided is anchored to the Calendar (`cal`) level.

### Viewing a Proof

You can of course view a proof in its entirety by asking
to see the proof associated with a `node_hash_id`.

```
chp show 52eb62c0-f556-11e7-bcf8-016fed1c55ad | jq

{
  "@context": "https://w3id.org/chainpoint/v3",
  "type": "Chainpoint",
  "hash": "2e75eaf17b8345c67234dfa92e867541ef41dda08baa6f8d5464fac432950794",
  "hash_id_node": "52eb62c0-f556-11e7-bcf8-016fed1c55ad",
  "hash_submitted_node_at": "2018-01-09T16:01:16Z",
  "hash_id_core": "534fc9e0-f556-11e7-b0bd-016959c78193",
  "hash_submitted_core_at": "2018-01-09T16:01:17Z",
  "branches": [
    {
      "label": "cal_anchor_branch",
      "ops": [
        {
          "l": "node_id:52eb62c0-f556-11e7-bcf8-016fed1c55ad"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "core_id:534fc9e0-f556-11e7-b0bd-016959c78193"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "nist:1515513660:042c2248a9b3af5f1d33f64bb3f8d6a2d1028409b9a028538cca63521e79aeb684f3a48cdbf2074cbf48e54fcd3375703d1ad56602e326a3805ebf1066f7aaff"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "986719:1515513680:1:https://b.chainpoint.org:cal:986719"
        },
        {
          "r": "4d8c2a7eab273ac9a7aa32e3c35805a4eaac3652be27142f8b459dd61737ab06"
        },
        {
          "op": "sha-256"
        },
        {
          "anchors": [
            {
              "type": "cal",
              "anchor_id": "986719",
              "uris": [
                "https://b.chainpoint.org/calendar/986719/hash"
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
  -n, --node-uri  specify uri of chainpoint node
                                   [string] [default: "http://0.0.0.0"]
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

If no node matching the configs can be connected to, then the cli will fallback to the old method of verification
by pinging Chainpoint nodes.

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
  -n, --node-uri  specify uri of chainpoint node
                                  [string] [default: "http://NODE_URI"]
  -q, --quiet   suppress all non-error output                          [boolean]
  -j, --json    format all output as json                              [boolean]
  --help        show help                                              [boolean]
```
