import { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda'
import { SQS } from 'aws-sdk'
import { parse } from 'parse-multipart-data'

const sqs = new SQS()
const QueueUrl = process.env.SQS_QUEUE || ''

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify({ event }))

	const boundary = event.headers['Content-Type']
		.split(';')[1]
		.trim()
		.split('=')[1]
	const fields = parse(Buffer.from(event.body || ''), boundary)
		.map(f => ({
			...f,
			data: f.data.toString(),
		}))
		.reduce(
			(f, { name, data }) => ({
				...f,
				[name as string]: data,
			}),
			{} as { [key: string]: string },
		)

	fields.envelope = JSON.parse(fields.envelope)
	fields.charsets = JSON.parse(fields.charsets)

	console.log(JSON.stringify(fields))

	const args = {
		MessageBody: JSON.stringify(fields),
		QueueUrl,
		MessageGroupId: event.path.substr(1),
		MessageDeduplicationId: event.requestContext.requestId,
	}

	await sqs.sendMessage(args).promise()

	console.log(JSON.stringify(args))

	return { statusCode: 202, body: '' }
}
