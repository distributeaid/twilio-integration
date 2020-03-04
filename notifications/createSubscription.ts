import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'
import { v4 } from 'uuid'

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
}): TE.TaskEither<ErrorInfo, string> => {
	const uuid = v4()
	return TE.tryCatch<ErrorInfo, string>(
		async () => {
			const query = {
				TableName,
				Item: {
					uuid: {
						S: uuid,
					},
					channel: {
						S: channel,
					},
					identity: {
						S: identity,
					},
					subscription: {
						S: `email:${email}`,
					},
				},
			}
			const res = await dynamodb.send(new PutItemCommand(query))
			console.log(JSON.stringify({ query, res }))
			return uuid
		},
		err => {
			console.error(
				JSON.stringify({
					createSubscription: { error: err, TableName },
				}),
			)
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)
}
