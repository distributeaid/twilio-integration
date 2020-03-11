import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'
import { randomWords } from '@bifravst/random-words'

export const addEmailToBeVerified = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({ email }: { email: string }): TE.TaskEither<ErrorInfo, string> =>
	pipe(
		TE.tryCatch<ErrorInfo, string>(
			async () => (await randomWords({ numWords: 3 })).join('-'),
			err => {
				console.error(
					JSON.stringify({
						createRandomWords: { error: err },
					}),
				)
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		),
		TE.map(code =>
			pipe(
				TE.tryCatch<ErrorInfo, string>(
					async () => {
						const query = {
							TableName,
							Item: {
								email: {
									S: email,
								},
								code: {
									S: code,
								},
							},
							ConditionExpression:
								'attribute_not_exists(email) AND attribute_not_exists(code) ',
						}
						const res = await dynamodb.send(new PutItemCommand(query))
						console.log(JSON.stringify({ query, res }))
						return code
					},
					err => {
						if ((err as Error).name === 'ConditionalCheckFailedException') {
							return {
								type: ErrorType.Conflict,
								message: (err as Error).message,
							}
						}
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
			),
		),
		TE.flatten,
	)
