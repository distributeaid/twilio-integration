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

const fetchSettings = getSendGridSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let sendGridSettings: Promise<Either<ErrorInfo, SendGridSettings>>

const dynamodb = new DynamoDBClient({})
const findSubscriptions = findSubscriptionByChannel({
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
		sendGridSettings = fetchSettings()
	}
	const maybeSettings = await sendGridSettings
	if (isLeft(maybeSettings)) {
		console.error(JSON.stringify(maybeSettings.left))
		return
	}
	const { apiKey, domain } = maybeSettings.right
	console.log(
		JSON.stringify({
			apiKey: apiKey.substr(0, 5) + '*****',
			domain,
		}),
	)
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
				findSubscriptions(channel),
				TE.map(subscriptions => ({
					channel,
					subscriptions: subscriptions
						.filter(subscription => subscription.startsWith('email:'))
						.map(subscription =>
							subscription.substr(subscription.indexOf(':') + 1),
						),
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

	const emails = emailSubscriptionsPerChannel.right.reduce(
		(emails, { subscriptions }) => [...new Set([...emails, ...subscriptions])],
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
	// 5. Send emails
}
