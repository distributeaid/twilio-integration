import { Context } from 'aws-lambda'
import { Twilio } from 'twilio'
import { getTwilioSettings, TwilioSettings } from '../getTwilioSettings'
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
	ssm: new SSM({ region: process.env.AWS_REGION }),
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>
const verify = verifyToken({
	ssm: new SSM({ region: process.env.AWS_REGION }),
})
const pe = publishEvent({
	sns: new SNS({ region: process.env.AWS_REGION }),
	topicArn: process.env.SNS_EVENTS_TOPIC || '',
})

export const handler = async (
	event: {
		token: string
		nick: string
	},
	context: Context,
) => {
	console.log({ event })
	const maybeValidToken = await verify(event.token)
	if (isLeft(maybeValidToken)) return GQLError(context, maybeValidToken.left)

	if (!twilioSettings) {
		twilioSettings = fetchSettings()
	}
	const maybeSettings = await twilioSettings
	if (isLeft(maybeSettings)) return GQLError(context, maybeSettings.left)

	const { nick } = event
	const { identity } = maybeValidToken.right
	const { restApiKey, accountSID, chatServiceSID } = maybeSettings.right

	const client = new Twilio(accountSID, restApiKey)
	const chatService = client.chat.services(chatServiceSID)

	const r = await pipe(
		fetchUser(chatService)(identity),
		TE.map(updateUserAttributes(chatService, { nick })),
		TE.map(async () =>
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
