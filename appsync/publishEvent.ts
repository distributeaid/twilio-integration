import { SNS } from 'aws-sdk'
import { ErrorInfo, ToErrorInfo } from './GQLError'
import { Event, EventWithPayload } from '../events/events'
import { tryCatch } from 'fp-ts/lib/TaskEither'

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
}) => async (event: Event | EventWithPayload) =>
	tryCatch<ErrorInfo, void>(async () => {
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
	}, ToErrorInfo('Publishing event'))()
