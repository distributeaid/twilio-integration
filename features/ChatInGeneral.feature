Feature: Chat in the general channel
  As a user
  I can join the general channel
  so I can chat with everyone

  Background:

    Given the GQL endpoint is "{graqphQLEndpoint}"
    And the GQL queries are authenticated with the API key "{graqphQLApiApiKey}"
    And I have a random UUID in "chatUserId"

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

  Scenario: Join chat channel "general" and post a new message

    Given I am authenticated against Twilio Chat with the token "{chatToken}"
    When I join the channel "general"
    And I post the message "Hello World from {chatUserId}!" in the channel "general"
    Then a message with the text "Hello World from {chatUserId}!" should exist in the channel "general"