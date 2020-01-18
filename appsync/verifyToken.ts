import { SSM } from 'aws-sdk'
import { Either, isLeft, right, left } from 'fp-ts/lib/Either'
import fetch from 'node-fetch'
import * as jwt from 'jsonwebtoken'
import { ErrorInfo } from './GQLError'
import { getChatSettings } from './get-chat-settings'
import { tryCatch } from 'fp-ts/lib/TaskEither'

type JWKS = {
	keys: {
		alg: 'ES256'
		kid: string
		use: 'sig'
		key: string
	}[]
}

const jwks: {
	[key: string]: Promise<Either<ErrorInfo, JWKS>>
} = {}

export type TokenInfo = { identity: string; contexts: string[] }

const fetchJWKS = async (url: string) =>
	tryCatch<ErrorInfo, JWKS>(
		async () => fetch(url).then(async res => res.json()),
		error => ({
			type: 'InternalError',
			message: (error as Error).message,
		}),
	)()

export const verifyToken = ({ ssm }: { ssm: SSM }) => {
	const fetchSettings = getChatSettings({
		ssm,
	})
	return async (token: string): Promise<Either<ErrorInfo, TokenInfo>> => {
		// Decode token
		const decoded = jwt.decode(token, { complete: true }) as null | {
			[key: string]: any
		}
		if (!decoded)
			return left({
				type: 'BadRequest',
				message: `Failed to decode token: "${token}"!`,
			})

		const { kid } = decoded.header
		if (!kid) {
			return left({
				type: 'BadRequest',
				message: 'Token has no key id!',
			})
		}

		if (!jwks[kid]) {
			jwks[kid] = fetchSettings().then(async maybeSettings => {
				if (isLeft(maybeSettings)) return maybeSettings
				return fetchJWKS(maybeSettings.right.jwks)
			})
		}
		const maybeJwks = await jwks[kid]
		if (isLeft(maybeJwks)) return maybeJwks

		// Find known key
		const knownKey = maybeJwks.right.keys.find(
			({ kid }) => decoded.header.kid === kid,
		)
		if (!knownKey) {
			console.log({ keys: maybeJwks.right.keys })
			return left({
				type: 'BadRequest',
				message: `Unknown key: "${decoded.header.kid}"!`,
			})
		}

		const { alg, key } = knownKey

		// Verify token
		const valid = jwt.verify(token, key, { algorithms: [alg] })
		if (!valid)
			return left({
				type: 'AccessDenied',
				message: `Invalid token: "${token}"!`,
			})

		return right({
			identity: decoded.payload.sub,
			contexts: decoded.payload.contexts,
		})
	}
}
