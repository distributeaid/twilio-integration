import { Context } from 'aws-lambda'
import { jwt } from 'twilio'
import { v4 } from 'uuid'
import { getTwilioSettings, TwilioSettings } from '../get-twilio-settings'
import { SSM } from 'aws-sdk'
import { ErrorInfo, GQLError } from '../GQLError'
import { Either, isLeft } from 'fp-ts/lib/Either'

const fetchSettings = getTwilioSettings({ ssm: new SSM({ region: process.env.AWS_REGION }) })
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>;

export const handler = async (
	event: {
		toolboxToken?: {
			jwt: string
		}
		deviceId: string
	},
	context: Context,
) => {
	console.log({ event })
	const { deviceId } = event
	if (!twilioSettings) {
		twilioSettings = fetchSettings()
	}
	const maybeSettings = await twilioSettings
	if (isLeft(maybeSettings)) return GQLError(context, maybeSettings.left)
	const {
		apiKey,
		apiSecret,
		accountSID,
		chatServiceSID
	} = maybeSettings.right
	const identity = `anonymous-${v4()}`
	const endpointId = `dachat:${identity}:${deviceId}`
	const token = new jwt.AccessToken(
		accountSID,
		apiKey,
		apiSecret,
		{
			identity: identity
		}
	)
	token.addGrant(new jwt.AccessToken.ChatGrant({
		serviceSid: chatServiceSID,
		endpointId: endpointId,
	}));

	return {
		identity,
		jwt: token.toJwt()
	}
}
