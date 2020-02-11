import { App, CfnOutput, RemovalPolicy, Stack } from '@aws-cdk/core'
import { Bucket, BucketAccessControl } from '@aws-cdk/aws-s3'

/**
 * This stack provides extras required for the end-to-end tests
 */
export class TwilioIntegrationTestExtrasStack extends Stack {
	public readonly websiteBucket: Bucket

	constructor(parent: App, id: string) {
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
	}
}
