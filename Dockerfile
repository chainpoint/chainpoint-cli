FROM node:8.17.0-jessie-slim

RUN apt-get update -y
RUN apt-get install -y curl make g++ git apt-transport-https ca-certificates python

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update -y && apt-get install -y --no-install-recommends yarn

WORKDIR /
RUN cd / && git clone https://github.com/chainpoint/chainpoint-cli.git
RUN cd /chainpoint-cli && git checkout origin/proof-v4 && yarn && yarn run build
RUN ls /chainpoint-cli/build
CMD ["/chainpoint-cli/build/chainpoint-cli-linux"]

