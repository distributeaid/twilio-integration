import { SSM } from 'aws-sdk'
import { getTwilioSettings } from '../appsync/getTwilioSettings'
import * as Twilio from 'twilio'
import { isLeft } from 'fp-ts/lib/Either'

getTwilioSettings({
	ssm: new SSM({ region: process.env.AWS_REGION }),
	scopePrefix: process.env.SSM_SCOPE_PREFIX,
})()
	.then(async maybeCfg => {
		if (isLeft(maybeCfg)) {
			console.error(maybeCfg.left.message)
			process.exit(1)
		}
		const cfg = maybeCfg.right
		const client = Twilio(cfg.accountSID, cfg.apiSecret)
		return client.chat
			.services(cfg.chatServiceSID)
			.channels('general')
			.members.list()
			.then(members =>
				members.filter(({ identity }) => identity.startsWith('anonymous-')),
			)
			.then(async anonMembers =>
				Promise.all(
					anonMembers.map(async ({ sid }) =>
						client.chat
							.services(cfg.chatServiceSID)
							.channels('general')
							.members(sid)
							.remove()
							.then(() => {
								console.log(`Removed ${sid} from "general".`)
							}),
					),
				),
			)
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
