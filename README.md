# Chainpoint CLI Client

An easy to install, and easy to use Command Line Interface (CLI) for the [Chainpoint](https://chainpoint.org) API.

With this tool you can submit hashes to the Chainpoint
Network, anchoring them to public blockchains, and retrieve a cryptographic proof of your submission.

With this easy to use CLI you can submit hashes,
retrieve and update proofs, verify proofs, and store
and manage proof data locally.

## Installation

### NPM package

```
npm install chainpoint-cli
```

### Binary Install

TBD

### Homebrew for macOS

TBD

## Usage

```
$ chainpoint
Usage: chainpoint <command> [options] <argument>

Commands:
  submit  submit a hash to be anchored
  update  retrieve an updated proof for your hash(es), if available
  verify  verify a proof's anchor claims
  import  import a proof
  export  export a proof
  list    display the status of every hash in the local database
  show    show the proof for a hash_id
  delete  delete a hash from the local database

Options:
  -s, --server  specify server to use [string] [default: "http://104.198.1.217"]
  --help        show help                                              [boolean]

You must specify a command.
```

## Development and Test

You will need a recent version of Node.js and the [Yarn](https://yarnpkg.com/en/) tool installed to get started. 

### Install CLI Dependencies

```
yarn
```

### Build Executables

```
# build executables for supported platforms in ./build/ dir
yarn build

# for more verbose output
yarn build-debug

# cleanup build artifacts
yarn build-clean
```