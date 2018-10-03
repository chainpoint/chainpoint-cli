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

### Install : Binary Single-File Executables

The following package scripts are provided to build and
install a compiled standalone system binary. These will
be used later for standalone installation without the need
to install Node.js/npm/yarn.

```
# Build a local executable targets
yarn run build

# Install a binary to `/usr/local/bin`
yarn run install-bin-macos

# Remove binary from `/usr/local/bin`
yarn uninstall-bin
```

### Install : NPM Global

This will install a Javascript executable using `npm`. Its recommended
to test with the binary installation method for your platform in most cases.

```
yarn run install-npm
yarn run uninstall-npm
```

## Publishing

### Version bump

First cut a `git flow` master branch release:

- `git flow release start vX.Y.Z`
- Modify the `package.json` and README files to bump the version number.
- Commit version changes
- `git flow release finish vX.Y.Z`, when asked to tag the release use simple `vX.Y.Z` as the tag annotation messge. See previous releases at [https://github.com/chainpoint/chainpoint-cli/releases](https://github.com/chainpoint/chainpoint-cli/releases)
- `git push` develop branch
- `git push origin master` master branch
- `git push --tags` to push the tag that will trigger a new binary build.

### Verify Github Release

- Verify that the TravisCI build passed cleanly [https://travis-ci.org/chainpoint/chainpoint-cli](https://travis-ci.org/chainpoint/chainpoint-cli)
- Verify that the binary release was pushed to [https://github.com/chainpoint/chainpoint-cli/releases](https://github.com/chainpoint/chainpoint-cli/releases)

### Publish to `npm`

- Ensure you are a collaborator on [https://www.npmjs.com/package/chainpoint-cli](https://www.npmjs.com/package/chainpoint-cli)
- Run `npm publish`
- Verify the new release was pushed to [https://www.npmjs.com/package/chainpoint-cli](https://www.npmjs.com/package/chainpoint-cli).
