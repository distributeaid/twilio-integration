import { Context } from 'aws-lambda'
import { Twilio } from 'twilio'
import {
	getTwilioSettings,
	TwilioSettings,
} from '../../twilio/getTwilioSettings'
import { SSM, SNS } from 'aws-sdk'
import { GQLError } from '../GQLError'
import { Either, isLeft } from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { verifyToken } from '../verifyToken'
import { NickUpdated } from '../../events/events'
import { publishEvent } from '../publishEvent'
import { ErrorInfo } from '../ErrorInfo'
import { pipe } from 'fp-ts/lib/pipeable'
import { fetchUser, updateUserAttributes } from '../../integration/api'

const fetchSettings = getTwilioSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>
const verify = verifyToken({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
const pe = publishEvent({
	sns: new SNS(),
	topicArn: process.env.SNS_EVENTS_TOPIC || '',
})

export const handler = async (
	event: {
		token: string
		nick: string
	},
	context: Context,
) => {
	console.log(JSON.stringify({ event }))
	const maybeValidToken = await verify(event.token)
	if (isLeft(maybeValidToken)) return GQLError(context, maybeValidToken.left)

	if (!twilioSettings) {
		twilioSettings = fetchSettings()
	}
	const maybeSettings = await twilioSettings
	if (isLeft(maybeSettings)) return GQLError(context, maybeSettings.left)

	const { nick } = event
	const { identity } = maybeValidToken.right
	const { apiKey, apiSecret, accountSID, chatServiceSID } = maybeSettings.right

	const client = new Twilio(apiKey, apiSecret, { accountSid: accountSID })
	const chatService = client.chat.services(chatServiceSID)

	const r = await pipe(
		fetchUser(chatService)(identity),
		TE.chain(updateUserAttributes(chatService, { nick })),
		TE.chain(() =>
			pe(
				NickUpdated({
					identity,
					nick,
				}),
			),
		),
	)()

	if (isLeft(r)) {
		return GQLError(context, r.left)
	}

	return true
}
