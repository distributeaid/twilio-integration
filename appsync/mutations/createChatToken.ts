import { Context } from 'aws-lambda'
import { jwt } from 'twilio'
import { getTwilioSettings, TwilioSettings } from '../get-twilio-settings'
import { SSM, SNS } from 'aws-sdk'
import { ErrorInfo, GQLError } from '../GQLError'
import { Either, isLeft } from 'fp-ts/lib/Either'
import { verifyToken } from '../verifyToken'
import { ChatTokenCreatedEvent } from '../events'
import { publishEvent } from '../publishEvent'

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
		deviceId: string
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

	const { deviceId } = event
	const { identity, contexts } = maybeValidToken.right
	const { apiKey, apiSecret, accountSID, chatServiceSID } = maybeSettings.right

	const endpointId = `dachat:${identity}:${deviceId}`
	const token = new jwt.AccessToken(accountSID, apiKey, apiSecret, {
		identity: identity,
	})
	token.addGrant(
		new jwt.AccessToken.ChatGrant({
			serviceSid: chatServiceSID,
			endpointId: endpointId,
		}),
	)

	// Publish event
	const r = await pe(
		ChatTokenCreatedEvent({
			identity,
			contexts,
		}),
	)
	if (isLeft(r)) {
		console.error(`Failed to publish event: ${r.left.message}`)
	}

	return token.toJwt()
}
