Feature: Enabled email notifications

    As a user
    I can enabled email notifications on a channel
    so I receive an email about new messages posted
    if I am offline

    Background:

        Given the GQL endpoint is "{graqphQLEndpoint}"
        And the GQL queries are authenticated with the API key "{graqphQLApiApiKey}"
        And I store a UUIDv4 as "chatUserId"
        And I store a UUIDv4 as "otherChatUserId"
        And I store a UUIDv4 as "shipmentId"

    Scenario: Enable notifications for the shipment channel

        Given I have a chat JWT for subject "{chatUserId}" and context "shipment-{shipmentId}" in "jwt"
        When I set the GQL variable "email" to "chatuser-{chatUserId}@{testEmailDomain}"
        And I set the GQL variable "channel" to "shipment-{shipmentId}"
        And I set the GQL variable "token" to "{jwt}"
        And I execute this GQL query
            """
            mutation enableChannelNotifications($channel: ID!, $email: String!, $token: ID!) {
            enableChannelNotifications(channel: $deviceId, email: $email, token: $token)
            }
            """
        Then the GQL query result should not contain errors

    Scenario: Receive the verification link and verify the ownership of the email

        When I receive an email for "chatuser-{chatUserId}@{testEmailDomain}"
        Then I store the link in the email as "{verificationLink}"
        Given I GET "{verificationLink}"
        Then the status code should be 202

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
        Given I am authenticated against Twilio Chat with the token "{chatToken}"
        When I join the channel "shipment-{shipmentId}"
        And I post the message "Hello {shipmentId} from {otherChatUserId}!" in the channel "shipment-{shipmentId}"
        # Receive email notification
        Then I receive an email for "chatuser-{chatUserId}@{testEmailDomain}"
        And the email subject should be "[Distribute Aid] New message in shipment-{shipmentId}"
        And the email body should contain "Hello {shipmentId} from {otherChatUserId}!"