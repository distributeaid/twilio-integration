import { App, CfnOutput, Stack } from '@aws-cdk/core'
import { Code, LayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { Bucket } from '@aws-cdk/aws-s3'
import * as SNS from '@aws-cdk/aws-sns'
import { TwilioIntegrationLayeredLambdas } from '../resources/lambdas'
import { ApiFeature } from '../features/api'

export class CoreStack extends Stack {
	public readonly eventsTopic: SNS.ITopic
	constructor(
		parent: App,
		id: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: TwilioIntegrationLayeredLambdas,
	) {
		super(parent, id)

		const sourceCodeBucket = Bucket.fromBucketName(
			this,
			'SourceCodeBucket',
			sourceCodeBucketName,
		)

		const baseLayer = new LayerVersion(this, `${id}-layer`, {
			code: Code.bucket(sourceCodeBucket, baseLayerZipFileName),
			compatibleRuntimes: [Runtime.NODEJS_10_X],
		})

		this.eventsTopic = new SNS.Topic(this, 'eventsTopic', {
			displayName: `${id}-eventsTopic`,
		})

		const api = new ApiFeature(
			this,
			'api',
			{
				createChatTokenMutation: Code.bucket(
					sourceCodeBucket,
					layeredLambdas.lambdaZipFileNames.createChatTokenMutation,
				),
				verifyTokenQuery: Code.bucket(
					sourceCodeBucket,
					layeredLambdas.lambdaZipFileNames.verifyTokenQuery,
				),
			},
			baseLayer,
			this.eventsTopic,
		)

		new CfnOutput(this, 'apiUrl', {
			value: api.api.attrGraphQlUrl,
			exportName: `${this.stackName}:apiUrl`,
		})

		new CfnOutput(this, 'apiKey', {
			value: api.apiKey.attrApiKey,
			exportName: `${this.stackName}:apiKey`,
		})
	}
}
