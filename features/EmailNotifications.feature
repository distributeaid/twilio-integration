Feature: Email notifications

    As a user
    I can enabled email notifications on a channel
    so I receive an email about new messages posted
    if I am offline

    Background:

        Given the GQL endpoint is "{graqphQLEndpoint}"
        And the GQL queries are authenticated with the API key "{graqphQLApiApiKey}"
        And the domain name for receiving emails is stored in "testEmailDomain"
        And I store a UUIDv4 as "chatUserId"
        And I store a UUIDv4 as "otherChatUserId"
        And I store a UUIDv4 as "shipmentId"

    Scenario: Join shipment chat channel and post a new message

        Given I have a chat JWT for subject "{chatUserId}" and context "shipment-{shipmentId}" in "jwt"
        When I set the GQL variable "deviceId" to "e2e-test"
        When I set the GQL variable "token" to "{jwt}"
        And I execute this GQL query
            """
            mutation createChatToken($deviceId: ID!, $token: ID!) {
            createChatToken(deviceId: $deviceId, token: $token)
            }
            """
        Then the GQL query result should not contain errors
        And I store the GQL operation result as "chatToken"
        Given I am authenticated against Twilio Chat with the token "{chatToken}"
        When I join the channel "shipment-{shipmentId}"
        And I post the message "Hei {shipmentId}, keep me posted! Bye, {chatUserId}." in the channel "shipment-{shipmentId}"
        Then a message with the text "Hei {shipmentId}, keep me posted! Bye, {chatUserId}." should exist in the channel "shipment-{shipmentId}"

    Scenario: Enable notifications for the shipment channel

        Given I have a chat JWT for subject "{chatUserId}" and context "shipment-{shipmentId}" in "jwt"
        When I set the GQL variable "email" to "chatuser-{chatUserId}@{testEmailDomain}"
        And I set the GQL variable "channel" to "shipment-{shipmentId}"
        And I set the GQL variable "token" to "{jwt}"
        And I execute this GQL query
            """
            mutation enableChannelNotifications($channel: ID!, $email: String!, $token: ID!) {
            enableChannelNotifications(channel: $channel, email: $email, token: $token) {
            emailVerified
            }
            }
            """
        Then the GQL query result should not contain errors
        And "data.enableChannelNotifications.emailVerified" of the GQL response should be false

    @Retry=failAfter:3,maxDelay:10000,initialDelay:5000
    Scenario: Receive the verification link and verify the ownership of the email

        Given I have a Webhook Receiver
        Then the Webhook Receiver "{testEmailDomain:id}" should be called
        And the webhook request body should match this JSON
            """
            {
                "to": "chatuser-{chatUserId}@{testEmailDomain}",
                "from": "DistributeAid Chat <toolbox@{sendGridDomainName}>",
                "subject": "[DistributeAid] Confirmation code"
            }
            """

    Scenario: Receive the verification code and use it to verify the ownership of the email

        Given I store "body.text" of the last webhook request into "emailBody"
        And I store the email verification code stored in "emailBody" as "verificationCode"
        When I set the GQL variable "email" to "chatuser-{chatUserId}@{testEmailDomain}"
        And I set the GQL variable "code" to "{verificationCode}"
        And I execute this GQL query
            """
            mutation verifyEmail($email: String!, $code: String!) {
            verifyEmail(email: $email, code: $code)
            }
            """
        Then the GQL query result should not contain errors

    # FIXME: Send messages as user so their profile exists

    Scenario: Receive an email notification about a new message

        # Another user posts a message
        Given I have a chat JWT for subject "{otherChatUserId}" and context "shipment-{shipmentId}" in "otherJwt"
        When I set the GQL variable "deviceId" to "e2e-test"
        When I set the GQL variable "token" to "{otherJwt}"
        And I execute this GQL query
            """
            mutation createChatToken($deviceId: ID!, $token: ID!) {
            createChatToken(deviceId: $deviceId, token: $token)
            }
            """
        Then the GQL query result should not contain errors
        And I store the GQL operation result as "otherChatToken"
        Given I am authenticated against Twilio Chat with the token "{otherChatToken}"
        When I join the channel "shipment-{shipmentId}"
        And I post the message "Hello {shipmentId} from {otherChatUserId}!" in the channel "shipment-{shipmentId}"
        # Receive email notification
        Then the Webhook Receiver "{testEmailDomain:id}" should be called
        And the webhook request body should match this JSON
            """
            {
                "to": "chatuser-{chatUserId}@{testEmailDomain}",
                "from": "DistributeAid Chat <toolbox@{sendGridDomainName}>",
                "subject": "[DistributeAid] New message in channel shipment-{shipmentId}"
            }
            """