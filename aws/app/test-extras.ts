import { App } from '@aws-cdk/core'
import { TwilioIntegrationTestExtrasStack } from '../stacks/test-extras'
import { TestExtrasLayeredLambdas } from '../resources/test-extras-lambdas'

export class TwilioIntegrationTestExtrasApp extends App {
	constructor(
		stackName: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: TestExtrasLayeredLambdas,
	) {
		super()

		new TwilioIntegrationTestExtrasStack(
			this,
			stackName,
			sourceCodeBucketName,
			baseLayerZipFileName,
			layeredLambdas,
		)
	}
}
