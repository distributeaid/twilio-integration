import { SSM } from 'aws-sdk'
import { getSettings } from './getSettings'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { ErrorType } from './ErrorInfo'
import { isNone, Some, Option } from 'fp-ts/lib/Option'

export type TwilioSettings = {
	apiKey: string
	apiSecret: string
	accountSID: string
	chatServiceSID: string
}

const unwrapOptionalKeys = <A>(o: { [key: string]: Option<unknown> }) =>
	Object.entries(o).reduce(
		(o, [k, v]) => ({
			...o,
			[k]: (v as Some<unknown>).value,
		}),
		{} as A,
	)

export const getTwilioSettings = ({
	ssm,
	scopePrefix,
}: {
	ssm: SSM
	scopePrefix?: string
}) =>
	pipe(
		getSettings({ ssm, scope: `${scopePrefix}twilio` }),
		TE.map(f => ({
			apiKey: f('apiKey'),
			apiSecret: f('apiSecret'),
			accountSID: f('accountSID'),
			chatServiceSID: f('chatServiceSID'),
		})),
		TE.map(cfg =>
			Object.values(cfg).filter(isNone).length
				? TE.left({
						type: ErrorType.EntityNotFound,
						message: 'Twilio configuration not available!',
				  })
				: TE.right(cfg),
		),
		TE.flatten,
		TE.map(cfg => unwrapOptionalKeys<TwilioSettings>(cfg)),
	)
