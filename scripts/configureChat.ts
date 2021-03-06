import { SSM, CloudFormation } from 'aws-sdk'
import { getTwilioSettings } from '../twilio/getTwilioSettings'
import { Twilio } from 'twilio'
import { isLeft } from 'fp-ts/lib/Either'
import * as chalk from 'chalk'
import { RoleInstance } from 'twilio/lib/rest/chat/v1/service/role'

const listRoles = ({
	client,
	chatServiceSID,
}: {
	client: Twilio
	chatServiceSID: string
}) => async () => client.chat.services(chatServiceSID).roles.list()

const createServiceRole = ({
	client,
	chatServiceSID,
}: {
	client: Twilio
	chatServiceSID: string
}) => async ({
	friendlyName,
	permissions,
}: {
	friendlyName: string
	permissions: string[]
}) =>
	client.chat.services(chatServiceSID).roles.create({
		friendlyName,
		permission: permissions,
		type: 'deployment',
	})

const listUsers = ({
	client,
	chatServiceSID,
}: {
	client: Twilio
	chatServiceSID: string
}) => async () => client.chat.services(chatServiceSID).users.list()

const getTwilioWebhookReceiverURL = async () =>
	new CloudFormation()
		.describeStacks({
			StackName: process.env.STACK_NAME,
		})
		.promise()
		.then(
			({ Stacks }) =>
				Stacks?.[0]?.Outputs?.find(
					({ OutputKey }) => OutputKey === 'twilioWebhookReceiverURL',
				)?.OutputValue,
		)

getTwilioSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})()
	.then(async maybeCfg => {
		if (isLeft(maybeCfg)) {
			console.error(maybeCfg.left.message)
			process.exit(1)
		}

		const twilioWebhookReceiverURL = await getTwilioWebhookReceiverURL()
		if (!twilioWebhookReceiverURL) {
			console.error(`Twilio Webhook Receiver URL not found!`)
			process.exit(1)
		}

		const cfg = maybeCfg.right
		const client = new Twilio(cfg.apiKey, cfg.apiSecret, {
			accountSid: cfg.accountSID,
		})
		const r = listRoles({ client, chatServiceSID: cfg.chatServiceSID })
		const c = createServiceRole({ client, chatServiceSID: cfg.chatServiceSID })
		const u = listUsers({ client, chatServiceSID: cfg.chatServiceSID })

		console.log(
			chalk.yellow('Chat service SID'),
			chalk.cyan(cfg.chatServiceSID),
		)

		console.log(
			chalk.yellow('Webhook Receiver'),
			chalk.cyan(twilioWebhookReceiverURL),
		)

		await client.chat.services(cfg.chatServiceSID).update({
			postWebhookUrl: twilioWebhookReceiverURL,
			webhookMethod: 'POST',
			reachabilityEnabled: true,
			webhookFilters: ['onMessageSent'],
		})

		const roles = await r()

		// Create a new service role for all users
		const userServiceRoleName = 'service role (anonymous access)'
		let userServiceRole = roles.find(
			({ friendlyName }) => friendlyName === userServiceRoleName,
		)
		if (!userServiceRole) {
			userServiceRole = await c({
				friendlyName: userServiceRoleName,
				permissions: ['editOwnUserInfo'],
			})
			console.log(
				chalk.blue(`User service role "${userServiceRoleName}" created.`),
			)
		}

		// Make this the default role
		await client.chat.services(cfg.chatServiceSID).update({
			defaultServiceRoleSid: userServiceRole.sid,
		})

		// Assign this role to all existing users
		await Promise.all(
			(await u()).map(async u =>
				client.chat
					.services(cfg.chatServiceSID)
					.users(u.sid)
					.update({
						roleSid: ((userServiceRole as unknown) as RoleInstance).sid,
					})
					.then(() => {
						console.log(
							chalk.yellow(
								`Default role "${userServiceRoleName}" assigned to user ${u.sid}.`,
							),
						)
					}),
			),
		)

		// Delete the default role
		const defaultServiceUserRole = roles.find(
			({ friendlyName }) => friendlyName === 'service user',
		)
		if (!defaultServiceUserRole) {
			console.log(chalk.magenta('"service user" role not found.'))
		} else {
			await client.chat
				.services(cfg.chatServiceSID)
				.roles(defaultServiceUserRole.sid)
				.remove()
			console.log(chalk.magenta('Default "service user" role removed.'))
		}
		console.log('')
		;(await r()).forEach(({ friendlyName, permissions }) => {
			console.log(chalk.gray('Role:'), chalk.blueBright(friendlyName))
			console.log(chalk.gray('Permissions:'))
			permissions.forEach(role => {
				console.log(chalk.blue(` ${role}`))
			})
			console.log('')
		})
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
