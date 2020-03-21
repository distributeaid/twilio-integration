import {
	DynamoDBClient,
	GetItemInput,
	GetItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'

export const findEmailVerification = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => (
	email: string,
): TE.TaskEither<ErrorInfo, { email: string; verified: boolean }> =>
	pipe(
		TE.tryCatch<ErrorInfo, { email: string; verified: boolean }>(
			async () => {
				const query: GetItemInput = {
					TableName,
					Key: {
						email: {
							S: email,
						},
					},
				}
				const res = await dynamodb.send(new GetItemCommand(query))
				console.log(JSON.stringify({ query, res }))
				return {
					email,
					verified: res.Item?.verified?.BOOL ?? false,
				}
			},
			err => {
				console.error(
					JSON.stringify({
						findSubscriptionByChannel: {
							error: err,
							TableName,
							email,
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
