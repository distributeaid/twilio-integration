import { SNS } from 'aws-sdk'
import { ToErrorInfo } from './GQLError'
import { Event, EventWithPayload } from '../events/events'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo } from './ErrorInfo'

const toValue = (v: string | string[] | number): SNS.MessageAttributeValue => {
	if (typeof v === 'string') {
		return {
			DataType: 'String',
			StringValue: v,
		}
	}
	if (Array.isArray(v)) {
		return {
			DataType: 'String.Array',
			StringValue: JSON.stringify(v),
		}
	}
	if (typeof v === 'number') {
		return {
			DataType: 'Number',
			StringValue: v.toString(),
		}
	}
	return {
		DataType: 'String',
		StringValue: JSON.stringify(v),
	}
}

export const publishEvent = ({
	sns,
	topicArn,
}: {
	sns: SNS
	topicArn: string
}) => (event: Event | EventWithPayload) =>
	TE.tryCatch<ErrorInfo, boolean>(async () => {
		await sns
			.publish({
				Message: JSON.stringify(event),
				MessageAttributes: {
					...('eventPayload' in event
						? Object.entries(event.eventPayload).reduce(
								(attributes, [k, v]) => ({
									...attributes,
									[k]: toValue(v),
								}),
								{} as SNS.MessageAttributeMap,
						  )
						: {}),
					eventName: {
						DataType: 'String',
						StringValue: event.eventName,
					},
				},
				TopicArn: topicArn,
			})
			.promise()
		console.log(
			JSON.stringify({
				event,
				topicArn,
			}),
		)
		return true
	}, ToErrorInfo('Publishing event'))
