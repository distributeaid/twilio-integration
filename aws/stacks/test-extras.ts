import { App, CfnOutput, RemovalPolicy, Stack } from '@aws-cdk/core'
import { Bucket, BucketAccessControl } from '@aws-cdk/aws-s3'
import { SendGridReceiver } from '../resources/SendGridReceiver'
import { TestExtrasLayeredLambdas } from '../resources/test-extras-lambdas'
import { Code, LayerVersion, Runtime } from '@aws-cdk/aws-lambda'

/**
 * This stack provides extras required for the end-to-end tests
 */
export class TwilioIntegrationTestExtrasStack extends Stack {
	public readonly websiteBucket: Bucket

	constructor(
		parent: App,
		id: string,
		sourceCodeBucketName: string,
		baseLayerZipFileName: string,
		layeredLambdas: TestExtrasLayeredLambdas,
	) {
		super(parent, id)
		this.websiteBucket = new Bucket(this, 'websiteBucket', {
			removalPolicy: RemovalPolicy.RETAIN,
			accessControl: BucketAccessControl.PUBLIC_READ,
			publicReadAccess: true,
			websiteErrorDocument: 'error.html',
			websiteIndexDocument: 'index.html',
		})

		new CfnOutput(this, 'bucketName', {
			value: this.websiteBucket.bucketName,
			exportName: `${this.stackName}:bucketName`,
		})

		new CfnOutput(this, 'bucketWebsiteUrl', {
			value: this.websiteBucket.bucketWebsiteUrl,
			exportName: `${this.stackName}:bucketWebsiteUrl`,
		})

		// Webhook receiver for incoming emails
		const sourceCodeBucket = Bucket.fromBucketName(
			this,
			'SourceCodeBucket',
			sourceCodeBucketName,
		)

		const sendGridReceiver = new SendGridReceiver(this, 'sendGridReceiver', {
			sendGridReceiverLambda: Code.bucket(
				sourceCodeBucket,
				layeredLambdas.lambdaZipFileNames.sendGridReceiver,
			),
			baseLayer: new LayerVersion(this, `${id}-layer`, {
				code: Code.bucket(sourceCodeBucket, baseLayerZipFileName),
				compatibleRuntimes: [Runtime.NODEJS_12_X],
			}),
		})
		new CfnOutput(this, 'sendGridReceiverApiUrl', {
			value: sendGridReceiver.api.url,
			exportName: `${this.stackName}:sendGridReceiverApiUrl`,
		})
		new CfnOutput(this, 'sendGridReceiverQueueURL', {
			value: sendGridReceiver.queue.queueUrl,
			exportName: `${this.stackName}:sendGridReceiverQueueURL`,
		})
	}
}

export type StackConfig = {
	sendGridReceiverApiUrl: string
	sendGridReceiverQueueURL: string
}
