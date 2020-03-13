import { Context } from 'aws-lambda'
import { SNS } from 'aws-sdk'
import { pipe } from 'fp-ts/lib/pipeable'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import { verifyEmailByCode } from '../verifyEmailByCode'
import { EmailVerified } from '../../events/events'
import { publishEvent } from '../../appsync/publishEvent'
import { unwrap } from '../../appsync/unwrap'

const verify = verifyEmailByCode({
	TableName: process.env.EMAIL_VERIFICATION_TABLE || '',
	dynamodb: new DynamoDBClient({}),
})

const pe = publishEvent({
	sns: new SNS(),
	topicArn: process.env.SNS_EVENTS_TOPIC || '',
})

export const handler = async (
	event: { email: string; code: string },
	context: Context,
) => {
	console.log(JSON.stringify({ event }))
	return unwrap(context)(
		pipe(
			verify(event),
			TE.map(
				pe(
					EmailVerified({
						email: event.email,
					}),
				),
			),
		),
	)
}
