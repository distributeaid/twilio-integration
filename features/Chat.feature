Feature: Chat
  As a user
  I can join a channel
  so I can chat

  Background:

    Given the GQL endpoint is "{graqphQLEndpoint}"
    And the GQL queries are authenticated with the API key "{graqphQLApiApiKey}"
    And I store a UUIDv4 as "chatUserId"

  Scenario: Create chat token using the JWT provided by the toolbox

    Given I have a chat JWT for subject "{chatUserId}" in "jwt"
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

  Scenario: Join chat channel "general"

    Given I am authenticated against Twilio Chat with the token "{chatToken}"
    When I have joined the channel "general"
    Then I post the message "Hello World!" in the channel "general"