Feature: Chat
    As a user
    I can join a channel
    so I can chat

    Background:

        Given the GQL endpoint is "{graqphQLEndpoint}"
        And the GQL queries are authorized with the API key "{graqphQLApiApiKey}"

    Scenario: Create chat token using the JWT provided by the toolbox

        Given I have a chat JWT in "jwt"
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

    # Scenario: Join chat channel "general"