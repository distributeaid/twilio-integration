import { SNSEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { isLeft, Either, isRight } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import {
	getSendGridSettings,
	SendGridSettings,
} from '../../sendgrid/getSendGridSettings'
import { ChannelSubscriptionCreatedEvent } from '../../events/events'
import { sendEmail } from '../sendEmail'
import { pipe } from 'fp-ts/lib/pipeable'
import { addEmailToBeVerified } from '../addEmailToBeVerified'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'

const fetchSettings = getSendGridSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let sendGridSettings: Promise<Either<ErrorInfo, SendGridSettings>>

const addEmail = addEmailToBeVerified({
	TableName: process.env.EMAIL_VERIFICATION_TABLE || '',
	dynamodb: new DynamoDBClient({}),
})

export const handler = async (event: SNSEvent) => {
	console.log(JSON.stringify({ event }))
	if (!sendGridSettings) {
		sendGridSettings = fetchSettings()
	}
	const maybeSettings = await sendGridSettings
	if (isLeft(maybeSettings)) {
		console.error(JSON.stringify(maybeSettings.left))
		return
	}
	const { apiKey, domain } = maybeSettings.right
	console.log(
		JSON.stringify({
			apiKey: apiKey.substr(0, 5) + '*****',
			domain,
		}),
	)
	const s = sendEmail({
		apiKey,
		from: {
			name: 'DistributeAid Chat',
			email: `toolbox@${domain}`,
		},
	})

	const apiEvent = JSON.parse(
		event.Records[0].Sns.Message,
	) as ChannelSubscriptionCreatedEvent
	const { email, uuid } = apiEvent.eventPayload

	const r = await pipe(
		addEmail({ email }),
		TE.chain(code =>
			s({
				to: { email },
				subject: `[DistributeAid] Confirmation code`,
				text: `
Hei,

here is the code to confirm your email:

	${code}

If you did not request to be notified, please simply 
ignore this message.

Remember: we take privacy and safety very seriously, 
you can always reach us at hello@distributeaid.org 
in case you have any questions!

-- 
Kind regards,
Your DistributeAid Platform Team
			`.trim(),
			}),
		),
	)()

	if (isRight(r)) {
		console.log(
			JSON.stringify({
				email,
				uuid,
			}),
		)
	} else {
		console.error(JSON.stringify(r.left))
	}
}
