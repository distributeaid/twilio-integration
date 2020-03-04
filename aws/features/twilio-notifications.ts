import * as CloudFormation from '@aws-cdk/core'

import * as DynamoDB from '@aws-cdk/aws-dynamodb'

export class TwilioNotificationFeature extends CloudFormation.Construct {
	public readonly subscriptionsTable: DynamoDB.Table
	constructor(
		stack: CloudFormation.Stack,
		id: string,
		{
			isTest,
		}: {
			isTest: boolean
		},
	) {
		super(stack, id)
		this.subscriptionsTable = new DynamoDB.Table(this, 'sunbscriptionsTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'uuid',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'channel',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
		})

		const SUBSCRIPTION_TABLE_CHANNEL_EMAIL_INDEX =
			'51ef75ee-8536-4683-8eee-8d250cd3c4cd'

		this.subscriptionsTable.addGlobalSecondaryIndex({
			indexName: SUBSCRIPTION_TABLE_CHANNEL_EMAIL_INDEX,
			partitionKey: {
				name: 'channel',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'subscription',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.INCLUDE,
			nonKeyAttributes: ['confirmed'],
		})
	}
}
