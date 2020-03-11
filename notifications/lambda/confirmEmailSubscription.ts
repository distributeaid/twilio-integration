import { Context, SNSEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { isLeft, Either, isRight } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import {
	getSendGridSettings,
	SendGridSettings,
} from '../../sendgrid/getSendGridSettings'
import { ChannelSubscriptionCreatedEvent } from '../../events/events'
import { sendEmail } from '../sendEmail'

const fetchSettings = getSendGridSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let sendGridSettings: Promise<Either<ErrorInfo, SendGridSettings>>

const confirmationEndpoint = process.env.CONFIRMATION_ENDPOINT

export const handler = async (event: SNSEvent, _: Context) => {
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
	const s = sendEmail({
		apiKey,
		from: {
			name: 'DistributeAid Chat',
			email: `toolbox@${domain}`,
		},
	})

	const apiEvent = JSON.parse(
		event.Records[0].Sns.Message,
	) as ChannelSubscriptionCreatedEvent
	const { email, uuid } = apiEvent.eventPayload
	const r = await s({
		to: { email },
		subject: `[DistributeAid] Please confirm your chat notifications`,
		text: `
Hei,

please click this link to confirm your email subscription: 
${confirmationEndpoint}?subscriptionId=${uuid}.

If you did not request to be notified, please simply 
ignore this message.

Remember: we take privacy and safety very seriously, 
you can always reach us at hello@distributeaid.org 
in case you have any questions!

Kind regards,
Your DistributeAid Platform Team
		`.trim(),
	})()

	if (isRight(r)) {
		console.log(
			JSON.stringify({
				email,
				uuid,
			}),
		)
	} else {
		console.error(JSON.stringify(r.left))
	}
}
