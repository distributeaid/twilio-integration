import { Context } from 'aws-lambda'
import { SSM, SNS } from 'aws-sdk'
import { GQLError, GQLErrorResult } from '../GQLError'
import { isLeft, Either } from 'fp-ts/lib/Either'
import { verifyToken } from '../verifyToken'
import { ChannelSubscriptionCreated } from '../../events/events'
import * as TE from 'fp-ts/lib/TaskEither'
import { publishEvent } from '../publishEvent'
import { ErrorType, ErrorInfo } from '../ErrorInfo'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { createSubscription } from '../../notifications/createSubscription'
import { pipe } from 'fp-ts/lib/pipeable'

const verify = verifyToken({
	ssm: new SSM({ region: process.env.AWS_REGION }),
	scopePrefix: process.env.STACK_NAME as string,
})
const pe = publishEvent({
	sns: new SNS({ region: process.env.AWS_REGION }),
	topicArn: process.env.SNS_EVENTS_TOPIC || '',
})
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION })

const subscribe = createSubscription({
	dynamodb,
	TableName: process.env.SUBSCRIPTIONS_TABLE || '',
})

const unwrap = (context: Context) => async (
	e: () => Promise<Either<ErrorInfo, unknown>>,
): Promise<GQLErrorResult | unknown> => {
	const r = await e()
	return isLeft(r) ? GQLError(context, r.left) : r.right
}

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
