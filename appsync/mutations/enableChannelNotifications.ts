import { Context } from 'aws-lambda'
import { SSM, SNS } from 'aws-sdk'
import { GQLError } from '../GQLError'
import { isLeft } from 'fp-ts/lib/Either'
import { verifyToken } from '../verifyToken'
import { ChannelSubscriptionCreated } from '../../events/events'
import * as TE from 'fp-ts/lib/TaskEither'
import { publishEvent } from '../publishEvent'
import { ErrorType } from '../ErrorInfo'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { createSubscription } from '../../notifications/createSubscription'
import { pipe } from 'fp-ts/lib/pipeable'
import { unwrap } from '../unwrap'
import { findEmailVerification } from '../../notifications/findEmailVerification'

const verify = verifyToken({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
const pe = publishEvent({
	sns: new SNS(),
	topicArn: process.env.SNS_EVENTS_TOPIC || '',
})
const dynamodb = new DynamoDBClient({})

const subscribe = createSubscription({
	dynamodb,
	TableName: process.env.SUBSCRIPTION_TABLE || '',
})

const findEmail = findEmailVerification({
	dynamodb,
	TableName: process.env.EMAIL_VERIFICATION_TABLE || '',
})

export const handler = async (
	event: {
		token: string
		email: string
		channel: string
	},
	context: Context,
) => {
	console.log(JSON.stringify({ event }))
	const maybeValidToken = await verify(event.token)
	if (isLeft(maybeValidToken)) return GQLError(context, maybeValidToken.left)

	const { channel, email } = event
	const { identity, contexts } = maybeValidToken.right

	console.log(JSON.stringify({ identity, contexts }))

	if (!contexts.includes(channel))
		return GQLError(context, {
			type: ErrorType.AccessDenied,
			message: `Channel "${channel}" is not subscribeable.`,
		})

	return unwrap(context)(
		pipe(
			subscribe({
				channel,
				email,
				identity,
			}),
			TE.chain(() =>
				pe(
					ChannelSubscriptionCreated({
						identity,
						channel,
						email,
					}),
				),
			),
			TE.chain(() => findEmail(email)),
			TE.map(({ verified }) => ({
				emailVerified: verified,
			})),
		),
	)
}
