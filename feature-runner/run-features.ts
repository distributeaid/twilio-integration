import {
	FeatureRunner,
	fetchStackConfiguration,
	ConsoleReporter,
	appSyncStepRunners,
	appSyncAfterAll,
	appSyncBeforeAll,
	webhookStepRunners,
} from '@coderbyheart/bdd-feature-runner-aws'
import * as chalk from 'chalk'
import * as program from 'commander'
import { StackConfig } from '../aws/stacks/core'
import { StackConfig as TestExtrasStackConfig } from '../aws/stacks/test-extras'
import { twilioIntegrationSteps } from './twilioIntegrationSteps'
import * as fs from 'fs'
import * as path from 'path'
import { uuidHelper } from './uuidHelpers'
import { sendGridSteps, sendGridAfterAll } from './sendGridSteps'
import { stackName } from '../aws/stackName'

let ran = false

export type World = {
	graqphQLEndpoint: string
	graqphQLApiApiKey: string
	region: string
	sendGridApiKey: string
	sendGridDomainName: string
	sendGridReceiverApiUrl: string
	sendGridReceiverQueueURL: string
	keyId: string
	privateKey: string
	webhookQueue: string
}

const region = process.env.AWS_REGION || ''
const keyId = process.env.KEY_ID || ''
const privateKey = fs
	.readFileSync(
		path.join(process.cwd(), `ecdsa-p256-${keyId}-private.pem`),
		'utf-8',
	)
	.toString()
const sendGridApiKey = process.env.SENDGRID_API_KEY || ''
const sendGridDomainName = process.env.SENDGRID_DOMAIN || ''

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.action(
		async (
			featureDir: string,
			{
				printResults,
				progress,
			}: { printResults: boolean; stack: string; progress: boolean },
		) => {
			ran = true

			const [stackConfig, testStackConfig] = await Promise.all([
				fetchStackConfiguration({
					StackName: stackName(),
					region: process.env.AWS_REGION as string,
				}) as Promise<StackConfig>,
				fetchStackConfiguration({
					StackName: stackName('test-extras'),
					region: process.env.AWS_REGION as string,
				}) as Promise<TestExtrasStackConfig>,
			])

			const world: World = {
				graqphQLEndpoint: stackConfig.apiUrl,
				graqphQLApiApiKey: stackConfig.apiKey,
				region,
				sendGridApiKey,
				sendGridDomainName,
				sendGridReceiverApiUrl: testStackConfig.sendGridReceiverApiUrl.replace(
					/\/+$/g,
					'',
				),
				sendGridReceiverQueueURL: testStackConfig.sendGridReceiverQueueURL,
				keyId,
				privateKey,
				webhookQueue: testStackConfig.sendGridReceiverQueueURL,
			}

			console.log(chalk.yellow.bold(' World:'))
			console.log()
			console.log(world)
			console.log()

			const runner = new FeatureRunner<World>(world, {
				dir: featureDir,
				reporters: [
					new ConsoleReporter({
						printResults,
						printProgress: progress,
						printSummary: true,
					}),
				],
			})

			await appSyncBeforeAll(runner)
			const { success } = await runner
				.addStepRunners(appSyncStepRunners())
				.addStepRunners(twilioIntegrationSteps())
				.addStepRunners(uuidHelper())
				.addStepRunners(sendGridSteps())
				.addStepRunners(
					webhookStepRunners<World>({ region }),
				)
				.run()
			await appSyncAfterAll(runner)
			await sendGridAfterAll(runner)
			if (!success) {
				process.exit(1)
				return
			}
			process.exit()
		},
	)
	.parse(process.argv)

if (!ran) {
	program.outputHelp(chalk.red)
	process.exit(1)
}
