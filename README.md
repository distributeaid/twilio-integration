# Distribute Aid in-app-chat Twilio integration

![Test and Release](https://github.com/distributeaid/twilio-integration/workflows/Test%20and%20Release/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![Mergify Status](https://img.shields.io/endpoint.svg?url=https://dashboard.mergify.io/badges/distributeaid/twilio-integration&style=flat)](https://mergify.io)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Integrates Twilio as a chat provider, built using AWS serverless components.

## Overview

> _Note:_ You can find the original description of the
> [feature here](https://gitlab.com/distribute-aid/toolbox/-/issues/95).

This project provides the chat feature for the
[Distribute Aid toolbox](https://gitlab.com/distribute-aid/toolbox) users of the
platform to have _context-specific_ chats, where a context for the chat is just
identified by its name, and it's the toolbox' responsibility to provide the
authentication tokens to the user which define the contexts the user is allowed
to access as JWT tokens.

This way the chat integration does not need to have any knowledge about toolbox
domain concepts (e.g. groups, shipments) and only needs to ensure that _a user_
has access to the chat rooms for the _contexts_ they are authorized for.

![Architecture](./docs/architecture.jpg)

_Fig. Architecture ([Source](https://miro.com/app/board/o9J_kvzYUeA=/))_

The JavaScript code that is responsible for rendering the chat window on the
page is loaded from an external source (this is basically a
microfrontend-approach where the chat microservice is able to independently
provide and update the UI). The code is minified and hosted on S3.

The chat is then instantiated with the context and the JWT, which is sent to
AppSync (which provides a GraphQL API for the Twilio integration and returns the
Twilio Access token to the UI), which then connects to the Twilio Chat API via
Websockets.

All request happen entirely outside of the toolbox.

## Architecture decision records (ADRs)

see [./adr](./adr).

## Deploy

> ℹ️ These instructions apply to Unix-based development environments; Linux and
> Mac users should be fine. Windows users could look into setting up their
> development environment using
> [WSL2](https://docs.microsoft.com/en-us/windows/wsl/wsl2-index).

Make sure your have AWS credentials in your environment.

    npm ci
    npx tsc

The Twilio API credentials need to be provided:

    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/apiKey --type String --value <Twilio API Key>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/apiSecret --type SecureString --value <API Secret>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/accountSID --type String --value <Account SID>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/chatServiceSID --type String --value <Chat Service SID>

The SendGrid API credentials need to be provided:

    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/sendgrid/apiKey --type String --value <SendGrid API Key>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/sendgrid/domain --type String --value <SendGrid Domain>

If this is the run the first time in an account

    npx cdk bootstrap
    npx cdk -a 'node dist/aws/cloudformation-sourcecode.js' deploy

Deploy the integration:

    npx cdk deploy

Fix the default Twilio permissions:

    node dist/scripts/configureChat.js

## Generating keypairs

`ES256` is used as the JWT algorithm.

Create an ID for the key:

    export KEY_ID=`uuidgen`

Create a private key (this should only be stored on a trusted system, e.g. the
toolbox):

    openssl ecparam -genkey -name secp256r1 -noout -out ecdsa-p256-${KEY_ID}-private.pem

Create the public key:

    openssl ec -in ecdsa-p256-${KEY_ID}-private.pem -pubout -out ecdsa-p256-${KEY_ID}-public.pem

Create a token for the user `alex`:

    node dist/scripts/generateToken.js ${KEY_ID} alex

Publish the JSON printed under `.well-known/jwks.json` on a public URL, e.g. on
Gist.

Example:

```json
{
  "keys": [
    {
      "alg": "ES256",
      "kid": "d873f691-0be2-4a74-bd82-525803415559",
      "use": "sig",
      "key": "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmpypazVR+GyYrFydspSI4tGkEp8M\nayNA41JFHjf17CrVB9GS2NUluTDsElRn3woOFD4qqNguWiuFkbwm7Keepw==\n-----END PUBLIC KEY-----"
    }
  ]
}
```

Register the URL with the integration:

    # disable URL resolution in the AWS CLI: aws configure set cli_follow_urlparam false
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/chat/jwks.json --type String --value <URL>

When verifying tokens, the integration will look up this URL to retrieve the
public key.

### API for generating tokens for a development environment

This API allows you to store the private key in the environment and generate
tokens using a HTTP API.

Deploy the API:

    npx cdk -a 'node dist/aws/cloudformation-dev-extras.js' deploy

Configure it:

    PRIVATE_KEY=`cat ecdsa-p256-${KEY_ID}-private.pem`
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}-dev-extras/chat-development/privateKey --type String --value "${PRIVATE_KEY}"
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}-dev-extras/chat-development/keyId --type String --value ${KEY_ID}

You can now generate token using the API provided by the stack:

    http POST '<apiurl>/token?identity=alex&context=general,random'

## Continuous Integration

This project is continuously tested using a real instance.
