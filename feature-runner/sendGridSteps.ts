/*eslint @typescript-eslint/camelcase: "warn"*/

import { regexGroupMatcher, FeatureRunner } from '@bifravst/e2e-bdd-test-runner'
import fetch from 'node-fetch'
import { World } from './run-features'
import { v4 } from 'uuid'

const createHostname = (hostname: string, receiverId: string) =>
	`${receiverId}.${hostname}`

export const sendGridSteps = () => [
	regexGroupMatcher<World>(
		/^the domain name for receiving emails is stored in "(?<storeName>[^"]+)"$/,
	)(async ({ storeName }, _, runner) => {
		const {
			sendGridDomainName,
			sendGridApiKey,
			sendGridReceiverApiUrl,
		} = runner.world
		const receiverId = v4()
		const hostname = createHostname(sendGridDomainName, receiverId)
		const res = await fetch(
			`https://api.sendgrid.com/v3/user/webhooks/parse/settings`,
			{
				headers: {
					Authorization: `Bearer ${sendGridApiKey}`,
				},
				method: 'POST',
				body: JSON.stringify({
					hostname,
					url: `${sendGridReceiverApiUrl}/${receiverId}`,
					spam_check: false,
					send_raw: false,
				}),
			},
		)
		if (res.status >= 400) {
			const body = await res.text()
			throw new Error(
				`Failed to register new email parse endpoint: (${res.status}) ${body}`,
			)
		}
		runner.store['sendgrid:receivers'] = [
			...(runner.store['sendgrid:receivers'] ?? []),
			receiverId,
		]
		runner.store[storeName] = hostname
		runner.store[`${storeName}:id`] = receiverId

		return [hostname, receiverId]
	}),
]

export const sendGridAfterAll = async (runner: FeatureRunner<World>) => {
	const { sendGridDomainName, sendGridApiKey } = runner.world
	await Promise.all(
		((runner.store['sendgrid:receivers'] as string[]) ?? []).map(
			async (receiver) => {
				const res = await fetch(
					`https://api.sendgrid.com/v3/user/webhooks/parse/settings/${createHostname(
						sendGridDomainName,
						receiver,
					)}`,
					{
						headers: {
							Authorization: `Bearer ${sendGridApiKey}`,
						},
						method: 'DELETE',
					},
				)
				if (res.status >= 400) {
					const body = await res.text()
					throw new Error(
						`Failed to delete email parse endpoint: (${res.status}) ${body}`,
					)
				}
			},
		),
	)
}
