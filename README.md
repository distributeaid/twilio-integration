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

    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/apiKey --type String --value <API Key>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/apiSecret --type SecureString --value <API Secret>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/accountSID --type String --value <Account SID>
    aws ssm put-parameter --name /${STACK_NAME:-twilio-integration-dev}/twilio/chatServiceSID --type String --value <Chat Service SID>

If this is the run the first time in an account

    npx cdk -a 'node dist/aws/cloudformation-sourcecode.js' deploy

Deploy the integration:

    npx cdk deploy

Fix the default Twilio permissions:

    node dist/scripts/fixPermissions.js

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

## Continuous Integration

This project is continuously tested using a real instance.
