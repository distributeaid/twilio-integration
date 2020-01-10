import { App } from '@aws-cdk/core'
import { TwilioIntegrationLayeredLambdas } from '../resources/lambdas'
import { CoreStack } from '../stacks/core'

export class TwilioIntegrationApp extends App {
	constructor(
		stackName = 'twilio-integration-dev',
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: TwilioIntegrationLayeredLambdas,
	) {
		super()

		new CoreStack(
			this,
			stackName,
			sourceCodeBucketName,
			baseLayerZipFileName,
			layeredLambdas,
		)
	}
}
