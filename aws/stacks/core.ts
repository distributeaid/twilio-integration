import { App, CfnOutput, Stack } from '@aws-cdk/core'
import { Code, LayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { Bucket } from '@aws-cdk/aws-s3'
import * as SNS from '@aws-cdk/aws-sns'
import { TwilioIntegrationLayeredLambdas } from '../resources/lambdas'
import { ApiFeature } from '../features/api'
import { IntegrationFeature } from '../features/integration'
import { TwilioNotificationFeature } from '../features/twilio-notifications'

export class CoreStack extends Stack {
	public readonly eventsTopic: SNS.ITopic
	constructor(
		parent: App,
		id: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: TwilioIntegrationLayeredLambdas,
		isTest: boolean,
	) {
		super(parent, id)

		const sourceCodeBucket = Bucket.fromBucketName(
			this,
			'SourceCodeBucket',
			sourceCodeBucketName,
		)

		const baseLayer = new LayerVersion(this, `${id}-layer`, {
			code: Code.bucket(sourceCodeBucket, baseLayerZipFileName),
			compatibleRuntimes: [Runtime.NODEJS_12_X],
		})

		this.eventsTopic = new SNS.Topic(this, 'eventsTopic', {
			displayName: `${id}-eventsTopic`,
		})

		const notifications = new TwilioNotificationFeature(this, 'notifications', {
			isTest,
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
				enableChannelNotificationsMutation: Code.bucket(
					sourceCodeBucket,
					layeredLambdas.lambdaZipFileNames.enableChannelNotificationsMutation,
				),
			},
			baseLayer,
			this.eventsTopic,
			notifications,
		)

		new CfnOutput(this, 'apiUrl', {
			value: api.api.attrGraphQlUrl,
			exportName: `${this.stackName}:apiUrl`,
		})

		new CfnOutput(this, 'apiKey', {
			value: api.apiKey.attrApiKey,
			exportName: `${this.stackName}:apiKey`,
		})

		new IntegrationFeature(
			this,
			'integration',
			{
				setUpUserChannelsLambda: Code.bucket(
					sourceCodeBucket,
					layeredLambdas.lambdaZipFileNames.setUpUserChannels,
				),
			},
			baseLayer,
			this.eventsTopic,
		)
	}
}

export type StackConfig = {
	apiUrl: string
	apiKey: string
}
