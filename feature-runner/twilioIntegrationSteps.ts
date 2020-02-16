import * as jwt from 'jsonwebtoken'
import { regexGroupMatcher } from '@coderbyheart/bdd-feature-runner-aws'

export const twilioIntegrationSteps = ({
	privateKey,
	keyId,
}: {
	privateKey: string
	keyId: string
}) => [
	regexGroupMatcher(
		/^I have a chat JWT for subject "(?<subject>[^"]+)" in "(?<storeName>[^"]+)"$/,
	)(async ({ subject, storeName }, _, runner) => {
		runner.store[storeName] = jwt.sign({ contexts: ['general'] }, privateKey, {
			algorithm: 'ES256',
			expiresIn: 24 * 60 * 60,
			subject,
			keyid: keyId,
		})
	}),
]
