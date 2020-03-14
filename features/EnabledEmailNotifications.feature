Feature: Enabled email notifications

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

    Scenario: Enable notifications for the shipment channel

        Given I have a chat JWT for subject "{chatUserId}" and context "shipment-{shipmentId}" in "jwt"
        When I set the GQL variable "email" to "chatuser-{chatUserId}@{testEmailDomain}"
        And I set the GQL variable "channel" to "shipment-{shipmentId}"
        And I set the GQL variable "token" to "{jwt}"
        And I execute this GQL query
            """
            mutation enableChannelNotifications($channel: ID!, $email: String!, $token: ID!) {
            enableChannelNotifications(channel: $channel, email: $email, token: $token)
            }
            """
        Then the GQL query result should not contain errors

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
#
#    Scenario: Receive an email notification about a new message
#
#        # Another user posts a message
#        Given I have a chat JWT for subject "{otherChatUserId}" and context "shipment-{shipmentId}" in "otherJwt"
#        When I set the GQL variable "deviceId" to "e2e-test"
#        When I set the GQL variable "token" to "{otherJwt}"
#        And I execute this GQL query
#            """
#            mutation createChatToken($deviceId: ID!, $token: ID!) {
#            createChatToken(deviceId: $deviceId, token: $token)
#            }
#            """
#        Then the GQL query result should not contain errors
#        And I store the GQL operation result as "otherChatToken"
#        Given I am authenticated against Twilio Chat with the token "{chatToken}"
#        When I join the channel "shipment-{shipmentId}"
#        And I post the message "Hello {shipmentId} from {otherChatUserId}!" in the channel "shipment-{shipmentId}"
#        # Receive email notification
#        Then I receive an email for "chatuser-{chatUserId}@{testEmailDomain}"
#        And the email subject should be "[Distribute Aid] New message in shipment-{shipmentId}"
#        And the email body should contain "Hello {shipmentId} from {otherChatUserId}!"