Feature: Chat in a shipment channel
  As a user
  I can join the channel for a shipment of my group
  so I can chat with everyone who is allowed to see this shipment

  Background:

    Given the GQL endpoint is "{graqphQLEndpoint}"
    And the GQL queries are authenticated with the API key "{graqphQLApiApiKey}"
    And I have a random UUID in "chatUserId"
    And I have a random UUID in "shipmentId"

  Scenario: Create chat token for a shipment using the JWT provided by the toolbox

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

  Scenario: Join shipment chat channel and post a new message

    Given I am authenticated against Twilio Chat with the token "{chatToken}"
    When I join the channel "shipment-{shipmentId}"
    And I post the message "Hello {shipmentId} from {chatUserId}!" in the channel "shipment-{shipmentId}"
    Then a message with the text "Hello {shipmentId} from {chatUserId}!" should exist in the channel "shipment-{shipmentId}"