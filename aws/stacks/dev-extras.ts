import { App, CfnOutput, Stack } from '@aws-cdk/core'
import { Bucket } from '@aws-cdk/aws-s3'
import { DevExtrasLayeredLambdas } from '../resources/dev-extras-lambdas'
import { Code, LayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { ChatTokenGeneratorAPI } from '../resources/ChatTokenGeneratorAPI'

/**
 * This stack provides extras for development.
 *
 * NOTE: This should not be deployed to a production environment.
 */
export class TwilioIntegrationDevExtrasStack extends Stack {
	constructor(
		parent: App,
		id: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: DevExtrasLayeredLambdas,
	) {
		super(parent, id)
		const sourceCodeBucket = Bucket.fromBucketName(
			this,
			'SourceCodeBucket',
			sourceCodeBucketName,
		)

		const generateChatTokenLambdaApi = new ChatTokenGeneratorAPI(
			this,
			'chatTokenGeneratorApi',
			{
				generateChatTokenLambda: Code.bucket(
					sourceCodeBucket,
					layeredLambdas.lambdaZipFileNames.generateChatToken,
				),
				baseLayer: new LayerVersion(this, `${id}-layer`, {
					code: Code.bucket(sourceCodeBucket, baseLayerZipFileName),
					compatibleRuntimes: [Runtime.NODEJS_12_X],
				}),
			},
		)
		new CfnOutput(this, 'generateChatTokenApiUrl', {
			value: generateChatTokenLambdaApi.api.url,
			exportName: `${this.stackName}:generateChatTokenApiUrl`,
		})
	}
}

export type StackConfig = {
	generateChatTokenApiUrl: string
}
