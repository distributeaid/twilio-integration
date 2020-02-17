import * as jwt from 'jsonwebtoken'
import { regexGroupMatcher } from '@coderbyheart/bdd-feature-runner-aws'
import { Client } from 'twilio-chat'
import { Channel } from 'twilio-chat/lib/channel'

let client: Client
const channels = new Map<string, Channel>()

export const twilioIntegrationSteps = ({
	privateKey,
	keyId,
}: {
	privateKey: string
	keyId: string
}) => [
	regexGroupMatcher(
		/^I have a chat JWT for subject "(?<subject>[^"]+)" in "(?<storeName>[^"]+)"$/,
	)(async ({ subject, storeName }, _, runner) => {
		runner.store[storeName] = jwt.sign({ contexts: ['general'] }, privateKey, {
			algorithm: 'ES256',
			expiresIn: 24 * 60 * 60,
			subject,
			keyid: keyId,
		})
	}),
	regexGroupMatcher(
		/^I am authenticated against Twilio Chat with the token "(?<chatToken>[^"]+)"$/,
	)(async ({ chatToken }) => {
		client = await Client.create(chatToken)
	}),
	regexGroupMatcher(/^I have joined the channel "(?<friendlyName>[^"]+)"$/)(
		async ({ friendlyName }) => {
			const channel = await client.getChannelByUniqueName(friendlyName)
			channels.set(friendlyName, channel)
			return channels.get(friendlyName)
		},
	),
	regexGroupMatcher(
		/^I post the message "(?<message>[^"]+)" in the channel "(?<friendlyName>[^"]+)"$/,
	)(async ({ message, friendlyName }) => {
		await channels.get(friendlyName)?.sendMessage(message)
	}),
]
