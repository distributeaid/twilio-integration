import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'

export const createSubscription = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({
	channel,
	email,
	identity,
}: {
	channel: string
	email: string
	identity: string
}): TE.TaskEither<ErrorInfo, boolean> =>
	TE.tryCatch<ErrorInfo, boolean>(
		async () => {
			const query = {
				TableName,
				Item: {
					channel: {
						S: channel,
					},
					subscription: {
						S: `email:${email}`,
					},
					identity: {
						S: identity,
					},
				},
			}
			const res = await dynamodb.send(new PutItemCommand(query))
			console.log(JSON.stringify({ query, res }))
			return true
		},
		(err) => {
			console.error(
				JSON.stringify({
					createSubscription: { error: (err as Error).message, TableName },
				}),
			)
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)
