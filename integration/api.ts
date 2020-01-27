import { tryCatch } from 'fp-ts/lib/TaskEither'
import { ServiceContext } from 'twilio/lib/rest/chat/v2/service'
import { ToErrorInfo } from '../appsync/GQLError'
import { MemberInstance } from 'twilio/lib/rest/chat/v2/service/channel/member'
import { ErrorInfo } from '../appsync/ErrorInfo'
import { UserInstance } from 'twilio/lib/rest/chat/v2/service/user'
import { ChannelInstance } from 'twilio/lib/rest/chat/v2/service/channel'

export const fetchMember = (chatService: ServiceContext) => ({
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

export const fetchUser = (chatService: ServiceContext) => (identity: string) =>
	tryCatch<ErrorInfo, UserInstance>(
		async () => chatService.users(identity).fetch(),
		ToErrorInfo(`Fetching user "${identity}" from Twilio`),
	)
export const updateUserAttributes = (
	chatService: ServiceContext,
	attributes: { [key: string]: string },
) => (user: UserInstance) =>
	tryCatch<ErrorInfo, UserInstance>(
		async () =>
			chatService
				.users(user.sid)
				.update({ attributes: JSON.stringify(attributes) }),
		ToErrorInfo(
			`Updating attributes "${JSON.stringify(attributes)}" for user "${
				user.sid
			}" on Twilio`,
		),
	)
export const createUser = (chatService: ServiceContext) => (identity: string) =>
	tryCatch<ErrorInfo, UserInstance>(async () => {
		const u = chatService.users.create({
			identity,
		})
		console.log(`Created user "${identity}" in Twilio.`)
		console.log(JSON.stringify({ user: u }))
		return u
	}, ToErrorInfo(`Creating user "${identity}" in Twilio.`))

export const joinChannel = (chatService: ServiceContext) => ({
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

export const fetchChannel = (chatService: ServiceContext) => ({
	channel,
}: {
	channel: string
}) =>
	tryCatch<ErrorInfo, ChannelInstance>(
		async () => chatService.channels(channel).fetch(),
		ToErrorInfo(`Fetching "${channel}" from Twilio.`),
	)

export const createChannel = (chatService: ServiceContext) => ({
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
