# Distribute Aid in-app-chat Twilio integration

![Test and Release](https://github.com/distributeaid/twilio-integration/workflows/Test%20and%20Release/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Integrates Twilio as a chat provider, built using AWS serverless components.

## Deploy

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
