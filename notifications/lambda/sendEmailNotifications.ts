import { SQSEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { isLeft, Either } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import {
	getSendGridSettings,
	SendGridSettings,
} from '../../sendgrid/getSendGridSettings'
import { TwilioChannelEvent } from './receiveTwilioWebhooks'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { findSubscriptionByChannel } from '../findSubscriptionByChannel'
import { pipe } from 'fp-ts/lib/pipeable'
import * as TE from 'fp-ts/lib/TaskEither'
import * as A from 'fp-ts/lib/Array'
import { findEmailVerification } from '../findEmailVerification'
import {
	getTwilioSettings,
	TwilioSettings,
} from '../../twilio/getTwilioSettings'
import { Twilio } from 'twilio'
import { fetchUser } from '../../integration/api'

const fetchSendgridSettings = getSendGridSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let sendGridSettings: Promise<Either<ErrorInfo, SendGridSettings>>

const fetchTwilioSettings = getTwilioSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>

const dynamodb = new DynamoDBClient({})
const findChannelSubscriptions = findSubscriptionByChannel({
	TableName: process.env.SUBSCRIPTIONS_TABLE || '',
	IndexName: process.env.SUBSCRIPTIONS_BY_CHANNEL_INDEX || '',
	dynamodb,
})
const findEmail = findEmailVerification({
	TableName: process.env.EMAIL_VERIFICATION_TABLE || '',
	dynamodb,
})

export const handler = async (event: SQSEvent) => {
	console.log(JSON.stringify({ event }))
	if (!sendGridSettings) {
		sendGridSettings = fetchSendgridSettings()
	}
	if (!twilioSettings) {
		twilioSettings = fetchTwilioSettings()
	}
	const [maybeSendGridSettings, maybeTwilioSettings] = await Promise.all([
		sendGridSettings,
		twilioSettings,
	])
	if (isLeft(maybeSendGridSettings)) {
		console.error(JSON.stringify(maybeSendGridSettings.left))
		return
	}
	if (isLeft(maybeTwilioSettings)) {
		console.error(JSON.stringify(maybeTwilioSettings.left))
		return
	}
	const { apiKey: sendGridApiKey, domain } = maybeSendGridSettings.right
	console.log(
		JSON.stringify({
			apiKey: sendGridApiKey.substr(0, 5) + '*****',
			domain,
		}),
	)

	const {
		apiKey: twilioApiKey,
		apiSecret,
		accountSID,
		chatServiceSID,
	} = maybeTwilioSettings.right
	const client = new Twilio(twilioApiKey, apiSecret, {
		accountSid: accountSID,
	})
	const chatService = client.chat.services(chatServiceSID)

	const { Records } = event
	const events: TwilioChannelEvent[] = Records.map(({ body }) =>
		JSON.parse(body),
	)
	const channelUniqueNames = [
		...new Set(events.map(({ channel }) => channel.uniqueName)),
	]

	const emailSubscriptionsPerChannel = await A.array.traverse(TE.taskEither)(
		channelUniqueNames,
		channel =>
			pipe(
				findChannelSubscriptions(channel),
				TE.map(channelSubscriptions => ({
					channel,
					subscriptions: channelSubscriptions
						.filter(({ subscription }) => subscription.startsWith('email:'))
						.map(({ subscription, identity }) => ({
							email: subscription.substr(subscription.indexOf(':') + 1),
							identity,
						})),
				})),
			),
	)()

	if (isLeft(emailSubscriptionsPerChannel)) {
		console.error(
			JSON.stringify({
				emailSubscriptions: emailSubscriptionsPerChannel.left,
			}),
		)
		return
	}

	console.log(
		JSON.stringify({
			subscriptions: emailSubscriptionsPerChannel.right,
		}),
	)

	const identities = emailSubscriptionsPerChannel.right.reduce(
		(identities, { subscriptions }) => [
			...new Set([
				...identities,
				...subscriptions.map(({ identity }) => identity),
			]),
		],
		[] as string[],
	)
	const users = await A.array.traverse(TE.taskEither)(
		identities,
		fetchUser(chatService),
	)()

	if (isLeft(users)) {
		console.error(
			JSON.stringify({
				users: users.left,
			}),
		)
		return
	}

	console.log(
		JSON.stringify({
			users: users.right,
		}),
	)

	const emails = emailSubscriptionsPerChannel.right.reduce(
		(emails, { subscriptions }) => [
			...new Set([...emails, ...subscriptions.map(({ email }) => email)]),
		],
		[] as string[],
	)

	const verifiedEmails = await A.array.traverse(TE.taskEither)(
		emails,
		findEmail,
	)()

	if (isLeft(verifiedEmails)) {
		console.error(
			JSON.stringify({
				verifiedEmails: verifiedEmails.left,
			}),
		)
		return
	}

	console.log(
		JSON.stringify({
			verifiedEmails: verifiedEmails.right,
		}),
	)

	// Done: 1. Sort messages by channel
	// Done: 2. Find subscriptions for channels
	// Done: 3. Filter by email
	// Done: 4. Find verified emails
	// Done: 5. Find inactive users
	// 6. Send emails
}
