import { SSM } from 'aws-sdk'
import { ErrorInfo } from './GQLError'
import { Either, left, right } from 'fp-ts/lib/Either'
import { getSettings } from './get-settings'

export type TwilioSettings = {
	apiKey: string
	apiSecret: string
	accountSID: string
	chatServiceSID: string
	restApiKey: string
}

export const getTwilioSettings = ({ ssm }: { ssm: SSM }) => async (): Promise<
	Either<ErrorInfo, TwilioSettings>
> => {
	const f = await getSettings({ ssm, scope: 'twilio' })

	const apiKey = f('apiKey')
	const apiSecret = f('apiSecret')
	const accountSID = f('accountSID')
	const chatServiceSID = f('chatServiceSID')
	const restApiKey = f('restApiKey')

	if (!apiKey || !apiSecret || !accountSID || !chatServiceSID || !restApiKey) {
		return left({
			type: 'EntityNotFound',
			message: 'Twilio configuration not available!',
		})
	}

	return right({
		apiKey,
		apiSecret,
		accountSID,
		chatServiceSID,
		restApiKey,
	})
}
