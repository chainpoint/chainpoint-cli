# Chainpoint CLI Client

An easy to install, and easy to use, Command Line Interface (CLI) for submitting hashes, and managing proofs, on the Tierion Network.

With this CLI you can submit hashes to a Tierion Network Node, anchor them to public blockchains, and retrieve a cryptographic proof showing your hash was submitted and anchored.

This tool also provides a simple local datastore
that helps keep track of every hash submitted, every `node_hash_id` returned, and stores and manages proofs locally for easy retrieval, export, and verification.

## Installation

### From `npmjs.org` Package Repository

```
yarn global add chainpoint-cli
```

## Usage

```
$ chp
Usage: chp <command> [options] <argument>

Commands:
  submit   submit a hash to be anchored
  update   retrieve an updated proof for your hash(es), if available
  verify   verify a proof's anchor claims
  import   import a proof
  export   export a proof
  list     display the status of every hash in the local database
  show     show the proof for a hash_id_node
  delete   delete a hash from the local database
  version  show the CLI version

Options:
  -s, --server  specify server to use
                                [string] [default: "http://127.0.0.1:9090"]
  -q, --quiet   suppress all non-error output                          [boolean]
  -j, --json    format all output as json                              [boolean]
  --help        show help                                              [boolean]

You must specify a command.
```

## Development and Test

You will need a recent version of Node.js and the [Yarn](https://yarnpkg.com/en/) tool installed to get started. 

Start by installing all `npm` dependencies:

```
yarn
```

### Run It Locally

```
./chp.js
```

### Install : Yarn

You can install/uninstall the `chp` binary from this repository globally with the following. This will install a Javascript
binary using Yarn:

```
yarn install-global
yarn uninstall-global
```

### Install : Binary Single-File Executables

The following package scripts are provided to build and
install a compiled standalone system binary.

```
# Build all local executable targets
yarn build
yarn build-debug
yarn build-clean

# Install a system binary to `/usr/local/bin`
yarn install-bin-macos
yarn install-bin-linux-x64
yarn install-bin-linux-x86
yarn install-bin-alpine

# Remove binary from `/usr/local/bin`
yarn uninstall-bin

```
