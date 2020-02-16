import {
	FeatureRunner,
	fetchStackConfiguration,
	ConsoleReporter,
	appSyncStepRunners,
	appSyncAfterAll,
	appSyncBeforeAll,
} from '@coderbyheart/bdd-feature-runner-aws'
import * as chalk from 'chalk'
import * as program from 'commander'
import { StackConfig } from '../aws/stacks/core'

let ran = false

export type World = {
	graqphQLEndpoint: string
	graqphQLApiApiKey: string
	region: string
}

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option(
		'-s, --stack <stack>',
		'Stack name',
		process.env.STACK_NAME || 'twilio-integration-dev',
	)
	.action(
		async (
			featureDir: string,
			{
				printResults,
				stack: stackName,
				progress,
			}: { printResults: boolean; stack: string; progress: boolean },
		) => {
			ran = true

			const stackConfig = (await fetchStackConfiguration({
				StackName: stackName,
				region: process.env.AWS_REGION as string,
			})) as StackConfig

			const world: World = {
				graqphQLEndpoint: stackConfig.apiUrl,
				graqphQLApiApiKey: stackConfig.apiKey,
				region: process.env.AWS_REGION!,
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
					}),
				],
			})

			await appSyncBeforeAll(runner)
			const { success } = await runner
				.addStepRunners(appSyncStepRunners())
				.run()
			await appSyncAfterAll(runner)
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