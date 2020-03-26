import { SSM } from 'aws-sdk'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { getSettings } from '../../appsync/getSettings'
import { ErrorType } from '../../appsync/ErrorInfo'
import { unwrapOptionalKeys } from '../../feature-runner/unwrapOptionalKeys'
import { isNone } from 'fp-ts/lib/Option'

export type ChatDevelopmentSettings = {
	privateKey: string
	keyId: string
}
export const getChatDevelopmentSettings = ({
	ssm,
	scopePrefix,
}: {
	ssm: SSM
	scopePrefix: string
}) =>
	pipe(
		getSettings({ ssm, scope: `${scopePrefix}/chat-development` }),
		TE.map((f) => ({
			privateKey: f('privateKey'),
			keyId: f('keyId'),
		})),
		TE.map((cfg) =>
			Object.values(cfg).filter(isNone).length
				? TE.left({
						type: ErrorType.EntityNotFound,
						message: 'Chat development configuration not available!',
				  })
				: TE.right(cfg),
		),
		TE.flatten,
		TE.map((cfg) => unwrapOptionalKeys<ChatDevelopmentSettings>(cfg)),
	)
