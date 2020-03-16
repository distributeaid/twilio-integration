import {
	DynamoDBClient,
	QueryCommand,
	QueryInput,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'

export const findSubscriptionByChannel = ({
	dynamodb,
	TableName,
	IndexName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
	IndexName: string
}) => (
	channel: string,
): TE.TaskEither<ErrorInfo, { subscription: string; identity: string }[]> =>
	pipe(
		TE.tryCatch<ErrorInfo, { subscription: string; identity: string }[]>(
			async () => {
				const query: QueryInput = {
					TableName,
					IndexName,
					KeyConditionExpression: '#channel = :channel',
					ExpressionAttributeNames: {
						'#channel': 'channel',
						'#identity': 'identity',
						'#subscription': 'subscription',
					},
					ExpressionAttributeValues: {
						':channel': {
							S: channel,
						},
					},
					ProjectionExpression: '#subscription,#identity',
				}
				const res = await dynamodb.send(new QueryCommand(query))
				console.log(JSON.stringify({ query, res }))
				return (res.Items || []).map(
					({
						subscription: { S: subscription },
						identity: { S: identity },
					}) => ({
						subscription: subscription as string,
						identity: identity as string,
					}),
				)
			},
			err => {
				console.error(
					JSON.stringify({
						findSubscriptionByChannel: {
							error: err,
							TableName,
							IndexName,
							channel,
						},
					}),
				)
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		),
	)
