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
import { findUser } from '../../integration/api'
import { isSome, Some } from 'fp-ts/lib/Option'
import { UserInstance } from 'twilio/lib/rest/chat/v2/service/user'
import { sendEmail } from '../sendEmail'

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
const ignoreOnlineStatus = process.env.IGNORE_ONLINE_STATUS === '1'

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
	const s = sendEmail({
		apiKey: sendGridApiKey,
		from: {
			name: 'DistributeAid Chat',
			email: `toolbox@${domain}`,
		},
	})

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
	const twilioUsers = await A.array.traverse(TE.taskEither)(
		identities,
		findUser(chatService),
	)()

	if (isLeft(twilioUsers)) {
		console.error(
			JSON.stringify({
				users: twilioUsers.left,
			}),
		)
		return
	}

	console.log(
		JSON.stringify({
			ignoreOnlineStatus,
		}),
	)
	const usersToNotify = twilioUsers.right
		.filter(u => isSome(u))
		.map(u => (u as Some<UserInstance>).value)
		.filter(u => (ignoreOnlineStatus ? true : !u.isOnline))

	const userIdentitesToNotify = usersToNotify.map(u => u.identity)

	console.log(
		JSON.stringify({
			usersToNotify,
		}),
	)

	const emails = emailSubscriptionsPerChannel.right.reduce(
		(emails, { subscriptions }) => [
			...new Set([...emails, ...subscriptions.map(({ email }) => email)]),
		],
		[] as string[],
	)

	const emailVerifications = await A.array.traverse(TE.taskEither)(
		emails,
		findEmail,
	)()

	if (isLeft(emailVerifications)) {
		console.error(
			JSON.stringify({
				verifiedEmails: emailVerifications.left,
			}),
		)
		return
	}

	const verifiedEmails = emailVerifications.right
		.filter(({ verified }) => verified)
		.map(({ email }) => email)

	console.log(
		JSON.stringify({
			verifiedEmails,
		}),
	)

	// Send subscriptions
	await Promise.all(
		emailSubscriptionsPerChannel.right.map(async ({ channel, subscriptions }) =>
			Promise.all(
				subscriptions
					.filter(
						({ email, identity }) =>
							verifiedEmails.includes(email) &&
							userIdentitesToNotify.includes(identity),
					)
					.map(async ({ email, identity }) => {
						const event = events.find(
							e => e.channel.uniqueName === channel,
						) as TwilioChannelEvent
						const user = usersToNotify.find(
							u => u.identity === identity,
						) as UserInstance
						const subject = `[DistributeAid] New message in channel ${event
							.channel.friendlyName || event.channel.uniqueName}`
						const text = `Hey ${user.friendlyName},
						
						${event.From} wrote on ${event.DateCreated}:
						> ${event.Body}

						-- 
						Kind regards,
						Your DistributeAid Platform Team
						`
						await pipe(
							s({
								to: { email },
								subject,
								text,
							}),
						)()
					}),
			),
		),
	)
}
