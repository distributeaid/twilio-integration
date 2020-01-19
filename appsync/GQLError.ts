import { Context } from 'aws-lambda'

export enum ErrorType {
	EntityNotFound = 'EntityNotFound',
	BadRequest = 'BadRequest',
	AccessDenied = 'AccessDenied',
	InternalError = 'InternalError',
}

export type ErrorInfo = {
	type: ErrorType
	message: string
}

/**
 * See $util.error(String, String, Object, Object)
 in https://docs.aws.amazon.com/appsync/latest/devguide/resolver-util-reference.html#utility-helpers-in-util
 */
export const GQLError = (context: Context, error: ErrorInfo) => {
	console.error(
		JSON.stringify({
			context,
			error,
		}),
	)
	return {
		errorType: error.type,
		errorMessage: error.message,
		data: {},
		errorInfo: {
			AWSrequestID: context.awsRequestId,
		},
	}
}

export const ToErrorInfo = (action: string, type = ErrorType.InternalError) => (
	error: unknown,
): ErrorInfo => ({
	type,
	message: `"${action}" failed: "${(error as Error).message}".`,
})
