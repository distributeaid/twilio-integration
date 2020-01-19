import { SSM } from 'aws-sdk'
import { ErrorInfo, ErrorType } from './GQLError'
import { Either, left, right } from 'fp-ts/lib/Either'
import { getSettings } from './getSettings'

export type ChatSettings = {
	jwks: string
}

export const getChatSettings = ({ ssm }: { ssm: SSM }) => async (): Promise<
	Either<ErrorInfo, ChatSettings>
> => {
	const f = await getSettings({ ssm, scope: 'chat' })

	const jwks = f('jwks.json')

	if (!jwks) {
		return left({
			type: ErrorType.EntityNotFound,
			message: 'Chat configuration not available!',
		})
	}

	return right({
		jwks,
	})
}
