import { Twilio } from 'twilio'
import { TwilioSettings, getTwilioSettings } from '../appsync/getTwilioSettings'
import { tryCatch, orElse } from 'fp-ts/lib/TaskEither'
import { Either } from 'fp-ts/lib/Either'
import { ServiceContext } from 'twilio/lib/rest/chat/v2/service'
import { ErrorInfo, ToErrorInfo } from '../appsync/GQLError'
import { UserInstance } from 'twilio/lib/rest/chat/v2/service/user'
import { SSM } from 'aws-sdk'
import { MemberInstance } from 'twilio/lib/rest/chat/v2/service/channel/member'
import { ChannelInstance } from 'twilio/lib/rest/chat/v2/service/channel'
import { isLeft } from 'fp-ts/lib/Either'
import { SNSEvent } from 'aws-lambda'

const fetchUser = (chatService: ServiceContext) => (identity: string) =>
	tryCatch<ErrorInfo, UserInstance>(
		async () => chatService.users(identity).fetch(),
		ToErrorInfo(`Fetching user "${identity}" from Twilio`),
	)

const createUser = (chatService: ServiceContext) => (identity: string) =>
	tryCatch<ErrorInfo, UserInstance>(async () => {
		const u = chatService.users.create({
			identity,
		})
		console.log(`Created user "${identity}" in Twilio.`)
		console.log(JSON.stringify({ user: u }))
		return u
	}, ToErrorInfo(`Creating user "${identity}" in Twilio.`))

const fetchMember = (chatService: ServiceContext) => ({
	identity,
	channel,
}: {
	identity: string
	channel: string
}) =>
	tryCatch<ErrorInfo, MemberInstance>(
		async () =>
			chatService
				.channels(channel)
				.members(identity)
				.fetch(),
		ToErrorInfo(
			`Fetching "${channel}" membership for user "${identity}" from Twilio.`,
		),
	)

const joinChannel = (chatService: ServiceContext) => ({
	identity,
	channel,
}: {
	identity: string
	channel: string
}) =>
	tryCatch<ErrorInfo, MemberInstance>(async () => {
		const m = await chatService.channels(channel).members.create({ identity })
		console.log(
			`Created "${channel}" membership for user "${identity}" in Twilio.`,
		)
		console.log(JSON.stringify({ member: m }))
		return m
	}, ToErrorInfo(`Creating "${channel}" membership for user "${identity}" in Twilio.`))

const fetchChannel = (chatService: ServiceContext) => ({
	channel,
}: {
	channel: string
}) =>
	tryCatch<ErrorInfo, ChannelInstance>(
		async () => chatService.channels(channel).fetch(),
		ToErrorInfo(`Fetching "${channel}" from Twilio.`),
	)

const createChannel = (chatService: ServiceContext) => ({
	channel,
}: {
	channel: string
}) =>
	tryCatch<ErrorInfo, ChannelInstance>(async () => {
		const c = await chatService.channels.create({ uniqueName: channel })
		console.log(`Created "${channel}" in Twilio.`)
		console.log(JSON.stringify({ channel: c }))
		return c
	}, ToErrorInfo(`Creating "${channel}" in Twilio.`))

const fetchSettings = getTwilioSettings({
	ssm: new SSM({ region: process.env.AWS_REGION }),
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
	const { accountSID, restApiKey, chatServiceSID } = maybeSettings.right

	const client = new Twilio(accountSID, restApiKey)
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
