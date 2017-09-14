# Chainpoint CLI Development

The following information is useful if you are doing
development on the Chainpoint CLI

## Development and Test

You will need a recent version of Node.js and the [Yarn](https://yarnpkg.com/en/) tool installed to get started. 

Start by installing all `npm.js` dependencies:

```
yarn
```

### Run It Locally

```
./chp.js
```

### Install w/ Yarn

You can install/uninstall the `chp` binary from this repository globally with the following. This will install a Javascript
binary using Yarn:

```
yarn install-global-yarn
yarn uninstall-global-yarn
```

### Install w/ NPM

You can install/uninstall the `chp` binary from this repository globally with the following. This will install a Javascript
binary using NPM:

```
yarn install-global-npm
yarn uninstall-global-npm
```

### Install : Binary Single-File Executables

The following package scripts are provided to build and
install a compiled standalone system binary. These will
be used later for standalone installation without the need
to install Node.js/npm/yarn.

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
