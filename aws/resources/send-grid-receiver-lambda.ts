import { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda'
import { SQS } from 'aws-sdk'
import { parse } from 'parse-multipart-data'

const sqs = new SQS()
const QueueUrl = process.env.SQS_QUEUE || ''

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify({ event }))
	const MessageAttributes = Object.keys(event.headers || {})
		.filter(key => !/^(CloudFront-|X-|Host|Via)/.test(key))
		.slice(0, 10) // max number of MessageAttributes is 10
		.reduce((hdrs, key) => {
			hdrs[key] = {
				DataType: 'String',
				StringValue: event.headers[key],
			}
			return hdrs
		}, {} as SQS.MessageBodyAttributeMap)

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

	console.log(JSON.stringify({ fields }))
	return sqs
		.sendMessage({
			MessageBody: JSON.stringify(fields),
			MessageAttributes: MessageAttributes || {},
			QueueUrl,
			MessageGroupId: event.path.substr(1),
			MessageDeduplicationId: event.requestContext.requestId,
		})
		.promise()
		.then(() => ({ statusCode: 202, body: '' }))
}
