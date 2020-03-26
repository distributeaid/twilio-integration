import { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import {
	getChatDevelopmentSettings,
	ChatDevelopmentSettings,
} from './getChatDevelopmentSettings'
import { Either, isLeft } from 'fp-ts/lib/Either'
import { ErrorInfo } from '../../appsync/ErrorInfo'
import * as jwt from 'jsonwebtoken'

const fetchSettings = getChatDevelopmentSettings({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})
let settings: Promise<Either<ErrorInfo, ChatDevelopmentSettings>>

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.debug(JSON.stringify({ event }))

	if (!settings) {
		settings = fetchSettings()
	}

	const maybeSettings = await settings
	if (isLeft(maybeSettings)) {
		console.error(JSON.stringify(maybeSettings.left))
		return {
			statusCode: 500,
			body: `${maybeSettings.left.message} (${maybeSettings.left.type})!`,
		}
	}

	const opts: jwt.SignOptions = {
		algorithm: 'ES256',
		expiresIn: 24 * 60 * 60,
		subject: event.queryStringParameters?.identity,
		keyid: maybeSettings.right.keyId,
	}
	const payload = { contexts: event.queryStringParameters?.contexts.split(',') }
	const token = jwt.sign(payload, maybeSettings.right.privateKey, opts)
	console.debug(
		JSON.stringify({
			opts,
			payload,
			token,
		}),
	)
	return {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(
			{
				opts,
				payload,
				token,
			},
			null,
			2,
		),
	}
}
