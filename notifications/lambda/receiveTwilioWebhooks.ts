import { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda'
import { SSM, SQS } from 'aws-sdk'
import * as querystring from 'querystring'
import {
	getTwilioSettings,
	TwilioSettings,
} from '../../twilio/getTwilioSettings'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import { Either, isLeft } from 'fp-ts/lib/Either'
import { Twilio } from 'twilio'
import { ChannelInstance } from 'twilio/lib/rest/chat/v2/service/channel'

const sqs = new SQS()
const QueueUrl = process.env.SQS_QUEUE || ''

type TwilioEvent = {
	EventType: 'onMessageSent'
	InstanceSid: string // 'IS67cd0f7c6804410ab5d4a0d64d7ca36c',
	Attributes: string // '{}',
	DateCreated: string // '2020-03-14T17:04:44.742Z',
	Index: string // '59',
	From: string // '5733596e-5909-4d54-b13e-7c8f4577a67e',
	MessageSid: string // 'IMffa72391e0b44654853d98dd3b32afc0',
	AccountSid: string // 'AC4fdddf7a7651dc87cbfb6be08ab1f04e',
	Source: string // 'SDK',
	ChannelSid: string // 'CH314021d59b244992a4d4edaaab75da02',
	ClientIdentity: string // '5733596e-5909-4d54-b13e-7c8f4577a67e',
	RetryCount: string // '0',
	Body: string // 'Hello World from 5733596e-5909-4d54-b13e-7c8f4577a67e!'
}

export type TwilioChannelEvent = TwilioEvent & {
	channel: ChannelInstance
}

const fetchSettings = getTwilioSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let twilioSettings: Promise<Either<ErrorInfo, TwilioSettings>>

const channelInfo = new Map<string, Promise<ChannelInstance>>()

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	const e = querystring.parse(
		Buffer.from(event.body || '', 'base64').toString('ascii'),
	) as TwilioEvent
	console.log(JSON.stringify({ event: e }))

	if (!twilioSettings) {
		twilioSettings = fetchSettings()
	}
	const maybeSettings = await twilioSettings
	if (isLeft(maybeSettings)) {
		console.error(
			`Failed to get Twilio settings: ${maybeSettings.left.message}!`,
		)
	} else {
		const {
			apiKey,
			apiSecret,
			accountSID,
			chatServiceSID,
		} = maybeSettings.right

		const client = new Twilio(apiKey, apiSecret, {
			accountSid: accountSID,
		})
		const chatService = client.chat.services(chatServiceSID)

		if (!channelInfo.has(e.ChannelSid)) {
			channelInfo.set(e.ChannelSid, chatService.channels(e.ChannelSid).fetch())
		}

		const channel = await channelInfo.get(e.ChannelSid)

		const message = {
			...e,
			channel,
		}

		const args: SQS.Types.SendMessageRequest = {
			MessageBody: JSON.stringify(message),
			QueueUrl,
			MessageGroupId: e.ChannelSid,
			MessageDeduplicationId: e.MessageSid,
		}

		await sqs.sendMessage(args).promise()

		console.log(
			JSON.stringify({
				QueueUrl,
				MessageBody: message,
				MessageGroupId: e.ChannelSid,
				MessageDeduplicationId: e.MessageSid,
			}),
		)
	}

	return { statusCode: 202, body: '' }
}
