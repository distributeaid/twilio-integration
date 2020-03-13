import { Context } from 'aws-lambda'
import { isLeft, Either } from 'fp-ts/lib/Either'
import { ErrorInfo } from './ErrorInfo'
import { GQLError, GQLErrorResult } from './GQLError'

export const unwrap = (context: Context) => async (
	e: () => Promise<Either<ErrorInfo, unknown>>,
): Promise<GQLErrorResult | unknown> => {
	const r = await e()
	return isLeft(r) ? GQLError(context, r.left) : r.right
}
