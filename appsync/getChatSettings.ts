import { SSM } from 'aws-sdk'
import { getSettings } from './getSettings'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorType } from './ErrorInfo'
import { getOrElse } from './fp-ts.util'

export type ChatSettings = {
	jwks: string
}

export const getChatSettings = ({
	ssm,
	scopePrefix,
}: {
	ssm: SSM
	scopePrefix: string
}) =>
	pipe(
		getSettings({ ssm, scope: `${scopePrefix}/chat` }),
		TE.map(f => f('jwks.json')),
		getOrElse.TE(() =>
			TE.left({
				type: ErrorType.EntityNotFound,
				message: 'Chat configuration not available!',
			}),
		),
	)
