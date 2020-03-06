import { SSM } from 'aws-sdk'
import { getSettings } from '../appsync/getSettings'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorType } from '../appsync/ErrorInfo'
import { isNone } from 'fp-ts/lib/Option'
import { unwrapOptionalKeys } from '../feature-runner/unwrapOptionalKeys'

export type SendGridSettings = {
	apiKey: string
	domain: string
}

export const getSendGridSettings = ({
	ssm,
	scopePrefix,
}: {
	ssm: SSM
	scopePrefix: string
}) =>
	pipe(
		getSettings({ ssm, scope: `${scopePrefix}/sendgrid` }),
		TE.map(f => ({
			apiKey: f('apiKey'),
			domain: f('domain'),
		})),
		TE.map(cfg =>
			Object.values(cfg).filter(isNone).length
				? TE.left({
						type: ErrorType.EntityNotFound,
						message: 'SendGrid configuration not available!',
				  })
				: TE.right(cfg),
		),
		TE.flatten,
		TE.map(cfg => unwrapOptionalKeys<SendGridSettings>(cfg)),
	)
