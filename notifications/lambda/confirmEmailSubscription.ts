import { Context, SNSEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { isLeft, Either } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import {
	getSendGridSettings,
	SendGridSettings,
} from '../../sendgrid/getSendGridSettings'

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
		apiKey,
		domain,
	})

	// FIXME: Send email with confirmation link
}
