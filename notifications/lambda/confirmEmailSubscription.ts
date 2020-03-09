import { Context, SNSEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { isLeft, Either } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import {
	getSendGridSettings,
	SendGridSettings,
} from '../../sendgrid/getSendGridSettings'
import { ChannelSubscriptionCreatedEvent } from '../../events/events'

const fetchSettings = getSendGridSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let sendGridSettings: Promise<Either<ErrorInfo, SendGridSettings>>

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
	console.log({
		apiKey: apiKey.substr(0, 5) + '*****',
		domain,
	})

	const apiEvent = JSON.parse(
		event.Records[0].Sns.Message,
	) as ChannelSubscriptionCreatedEvent
	const { email, uuid } = apiEvent.eventPayload
	console.log({
		email,
		uuid,
	})

	// FIXME: Send email with confirmation link
	console.error(
		`FIXME: Implement sending email to ${email} to confirm subscription ${uuid}!`,
	)
}
