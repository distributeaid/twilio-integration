import { Context } from 'aws-lambda'
import { jwt } from 'twilio'
import { getTwilioSettings, TwilioSettings } from '../get-twilio-settings'
import { SSM } from 'aws-sdk'
import { ErrorInfo, GQLError } from '../GQLError'
import { Either, isLeft } from 'fp-ts/lib/Either'
import { verifyToken } from '../verifyToken'

const fetchSettings = getTwilioSettings({
	ssm: new SSM({ region: process.env.AWS_REGION }),
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>
const verify = verifyToken({
	ssm: new SSM({ region: process.env.AWS_REGION }),
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
	const { identity } = maybeValidToken.right
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

	return token.toJwt()
}
