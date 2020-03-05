import { Context } from 'aws-lambda'
import { SSM } from 'aws-sdk'
import { GQLError } from '../GQLError'
import { isLeft } from 'fp-ts/lib/Either'
import { verifyToken } from '../verifyToken'

const verify = verifyToken({
	ssm: new SSM(),
	scopePrefix: process.env.STACK_NAME as string,
})

export const handler = async (
	event: {
		token: string
	},
	context: Context,
) => {
	console.log(JSON.stringify({ event }))
	const maybeValid = await verify(event.token)
	if (isLeft(maybeValid)) return GQLError(context, maybeValid.left)
	return maybeValid.right
}
