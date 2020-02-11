import { App } from '@aws-cdk/core'
import { TwilioIntegrationTestExtrasStack } from '../stacks/test-extras'

export class TwilioIntegrationTestExtrasApp extends App {
	constructor(stackName: string) {
		super()

		new TwilioIntegrationTestExtrasStack(this, stackName)
	}
}
