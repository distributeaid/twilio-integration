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
	TableName: process.env.SUBSCRIPTIONS_TABLE || '',
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
			pipe(
				TE.right({
					channel,
					email,
					identity,
				}),
				TE.map(subscribe),
				TE.flatten,
				TE.chain(uuid =>
					pipe(
						pe(
							ChannelSubscriptionCreated({
								uuid,
								identity,
								channel,
								email,
							}),
						),
						TE.map(() => uuid),
					),
				),
			),
		),
	)
}
