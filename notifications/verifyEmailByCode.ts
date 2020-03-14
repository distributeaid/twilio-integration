import {
	DynamoDBClient,
	UpdateItemCommand,
	UpdateItemInput,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'

export const verifyEmailByCode = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({
	email,
	code,
}: {
	email: string
	code: string
}): TE.TaskEither<ErrorInfo, boolean> =>
	pipe(
		TE.tryCatch<ErrorInfo, boolean>(
			async () => {
				const query: UpdateItemInput = {
					TableName,
					Key: {
						email: {
							S: email,
						},
					},
					UpdateExpression: `SET #verified = :verified`,
					ExpressionAttributeNames: {
						'#verified': 'verified',
						'#code': 'code',
					},
					ExpressionAttributeValues: {
						':verified': {
							BOOL: true,
						},
						':code': {
							S: code,
						},
					},
					ConditionExpression: '#code =:code',
				}
				const res = await dynamodb.send(new UpdateItemCommand(query))
				console.log(JSON.stringify({ query, res }))
				return true
			},
			err => {
				console.error(
					JSON.stringify({
						addCellToCacheIfNotExists: { error: err, TableName },
					}),
				)
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		),
	)
