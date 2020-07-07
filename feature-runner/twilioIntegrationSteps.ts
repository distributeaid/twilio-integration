import * as jwt from 'jsonwebtoken'
import { regexGroupMatcher } from '@bifravst/e2e-bdd-test-runner'
import { Client } from 'twilio-chat'
import { Channel } from 'twilio-chat/lib/channel'
import { expect } from 'chai'
import { World } from './run-features'

let client: Client
const channels = new Map<string, Channel>()

export const twilioIntegrationSteps = () => [
	regexGroupMatcher<World>(
		/^I have a chat JWT for subject "(?<subject>[^"]+)"(?: and context "(?<context>[^"]+)")? in "(?<storeName>[^"]+)"$/,
	)(async ({ subject, storeName, context }, _, runner) => {
		const { privateKey, keyId } = runner.world
		runner.store[storeName] = jwt.sign(
			{ contexts: [context || 'general'] },
			privateKey,
			{
				algorithm: 'ES256',
				expiresIn: 24 * 60 * 60,
				subject,
				keyid: keyId,
			},
		)
	}),
	regexGroupMatcher(
		/^I am authenticated against Twilio Chat with the token "(?<chatToken>[^"]+)"$/,
	)(async ({ chatToken }) => {
		client = await Client.create(chatToken)
	}),
	regexGroupMatcher(/^I join the channel "(?<friendlyName>[^"]+)"$/)(
		async ({ friendlyName }) => {
			const channel = await client.getChannelByUniqueName(friendlyName)
			channels.set(friendlyName, channel)
			return channels.get(friendlyName)?.sid
		},
	),
	regexGroupMatcher(
		/^I post the message "(?<message>[^"]+)" in the channel "(?<friendlyName>[^"]+)"$/,
	)(async ({ message, friendlyName }) => {
		const channel = channels.get(friendlyName)
		if (!channel) {
			throw new Error(`Unknown channel "${friendlyName}"!`)
		}
		return await channel.sendMessage(message)
	}),
	regexGroupMatcher(
		/^a message with the text "(?<message>[^"]+)" should exist in the channel "(?<friendlyName>[^"]+)"$/,
	)(async ({ message, friendlyName }) => {
		const channel = channels.get(friendlyName)
		if (!channel) {
			throw new Error(`Unknown channel "${friendlyName}"!`)
		}
		const messages = await channel.getMessages(1)
		expect(messages.items[0].body).to.equal(message)
	}),
	regexGroupMatcher(
		/^I store the email verification code stored in "(?<storageSourceName>[^"]+)" as "(?<storageTargetName>[^"]+)"$/,
	)(async ({ storageSourceName, storageTargetName }, _, runner) => {
		const body = runner.store[storageSourceName]
		expect(body).to.not.be.an('undefined')
		const code = /[a-z]{8}-[a-z]{8}-[a-z]{8}/.exec(
			body as string,
		) as RegExpMatchArray
		expect(body).to.not.be.null
		runner.store[storageTargetName] = code[0]
		return code[0]
	}),
]
