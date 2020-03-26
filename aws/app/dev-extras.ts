import { App } from '@aws-cdk/core'
import { TwilioIntegrationDevExtrasStack } from '../stacks/dev-extras'
import { DevExtrasLayeredLambdas } from '../resources/dev-extras-lambdas'

export class TwilioIntegrationDevExtrasApp extends App {
	constructor(
		stackName: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: DevExtrasLayeredLambdas,
	) {
		super()

		new TwilioIntegrationDevExtrasStack(
			this,
			stackName,
			sourceCodeBucketName,
			baseLayerZipFileName,
			layeredLambdas,
		)
	}
}
