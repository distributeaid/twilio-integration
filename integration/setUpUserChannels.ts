import { Twilio } from 'twilio'
import { TwilioSettings, getTwilioSettings } from '../appsync/getTwilioSettings'
import { orElse } from 'fp-ts/lib/TaskEither'
import { Either } from 'fp-ts/lib/Either'
import { UserInstance } from 'twilio/lib/rest/chat/v2/service/user'
import { SSM } from 'aws-sdk'
import { MemberInstance } from 'twilio/lib/rest/chat/v2/service/channel/member'
import { ChannelInstance } from 'twilio/lib/rest/chat/v2/service/channel'
import { isLeft } from 'fp-ts/lib/Either'
import { SNSEvent } from 'aws-lambda'
import { ErrorInfo } from '../appsync/ErrorInfo'
import {
	fetchMember,
	createUser,
	fetchUser,
	createChannel,
	fetchChannel,
	joinChannel,
} from './api'

const fetchSettings = getTwilioSettings({
	ssm: new SSM({ region: process.env.AWS_REGION }),
	scopePrefix: process.env.STACK_NAME as string,
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>

export const handler = async ({ Records }: SNSEvent) => {
	console.log(JSON.stringify({ Records }))
	const {
		Sns: {
			MessageAttributes: {
				identity: { Value: identity },
				contexts: { Value: contexts },
			},
		},
	} = Records[0]
	if (!twilioSettings) {
		twilioSettings = fetchSettings()
	}
	const maybeSettings = await twilioSettings
	if (isLeft(maybeSettings)) {
		console.error(JSON.stringify(maybeSettings.left))
		return
	}
	const { apiKey, accountSID, apiSecret, chatServiceSID } = maybeSettings.right

	const client = new Twilio(apiKey, apiSecret, { accountSid: accountSID })
	const chatService = client.chat.services(chatServiceSID)

	const maybeUser = await orElse<ErrorInfo, UserInstance, ErrorInfo>(() =>
		createUser(chatService)(identity),
	)(fetchUser(chatService)(identity))()

	if (isLeft(maybeUser)) {
		console.error(JSON.stringify(maybeUser.left))
		return
	}

	await Promise.all(
		(JSON.parse(contexts) as string[]).map(async context =>
			orElse<ErrorInfo, ChannelInstance, ErrorInfo>(() =>
				createChannel(chatService)({ channel: context }),
			)(fetchChannel(chatService)({ channel: context }))().then(async () =>
				orElse<ErrorInfo, MemberInstance, ErrorInfo>(() =>
					joinChannel(chatService)({ identity, channel: context }),
				)(fetchMember(chatService)({ identity, channel: context }))(),
			),
		),
	)
}
