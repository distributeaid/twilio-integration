# Distribute Aid in-app-chat Twilio integration

[![GitHub Actions](https://github.com/distributeaid/twilio-integration/workflows/Test%20and%20Release/badge.svg)](https://github.com/distributeaid/twilio-integration/actions)
[![Greenkeeper badge](https://badges.greenkeeper.io/distributeaid/twilio-integration.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

Integrates Twilio as a chat provider, built using AWS serverless components.

## Deploy

Make sure your have AWS credentials in your environment.

    npm ci
    npx tsc

The Twilio API credentials need to be provided:

    aws ssm put-parameter --name /twilio/apiKey --type String --value <API Key>
    aws ssm put-parameter --name /twilio/apiSecret --type SecretString --value <API Secret>
    aws ssm put-parameter --name /twilio/accountSID --type String --value <Account SID>
    aws ssm put-parameter --name /twilio/chatServiceSID --type String --value <Chat Service SID>
    aws ssm put-parameter --name /twilio/restApiKey --type SecretString --value <REST API Key>

If this is the run the first time in an account

    npx cdk -a 'node dist/aws/cloudformation-sourcecode.js' deploy

Deploy the integration:

    npx cdk deploy

## Tests

    export STACK_NAME=${STACK_NAME:-twilio-integration-dev}
    npm test
