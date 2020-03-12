import * as CDK from '@aws-cdk/core'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as SNS from '@aws-cdk/aws-sns'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as IAM from '@aws-cdk/aws-iam'
import * as Logs from '@aws-cdk/aws-logs'
import { EventName } from '../../events/events'

export const emailVerificationCodeIndex = '07c74665-b990-45e7-b8ef-004d981c44d1'

export class TwilioNotificationFeature extends CDK.Construct {
	public readonly subscriptionsTable: DynamoDB.Table
	public readonly emailVerificationTable: DynamoDB.Table

	constructor(
		stack: CDK.Stack,
		id: string,
		isTest: boolean,
		lambdas: {
			confirmEmailSubscription: Lambda.Code
		},
		baseLayer: Lambda.ILayerVersion,
		eventsTopic: SNS.ITopic,
	) {
		super(stack, id)

		// Stores subscriptions
		this.subscriptionsTable = new DynamoDB.Table(this, 'subscriptionsTable', {
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
				? CDK.RemovalPolicy.DESTROY
				: CDK.RemovalPolicy.RETAIN,
		})

		// Stores verifications of email address ownerships
		this.emailVerificationTable = new DynamoDB.Table(
			this,
			'emailVerificationTable',
			{
				billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
				partitionKey: {
					name: 'email',
					type: DynamoDB.AttributeType.STRING,
				},
				removalPolicy: isTest
					? CDK.RemovalPolicy.DESTROY
					: CDK.RemovalPolicy.RETAIN,
			},
		)

		this.emailVerificationTable.addGlobalSecondaryIndex({
			indexName: emailVerificationCodeIndex,
			partitionKey: {
				name: 'code',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.KEYS_ONLY,
		})

		const confirmEmailSubscriptionLambda = new Lambda.Function(
			this,
			`confirmEmailSubscriptionLambda`,
			{
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CDK.Duration.seconds(30),
				memorySize: 1792,
				description: 'Sends an email to the user to confirm their subscription',
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: [
							'logs:CreateLogGroup',
							'logs:CreateLogStream',
							'logs:PutLogEvents',
						],
						resources: [
							`arn:aws:logs:${stack.region}:${stack.account}:/aws/lambda/*`,
						],
					}),
					new IAM.PolicyStatement({
						actions: ['ssm:GetParametersByPath'],
						resources: [
							`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/sendgrid`,
						],
					}),
					new IAM.PolicyStatement({
						actions: ['dynamoDb:PutItem'],
						resources: [this.emailVerificationTable.tableArn],
					}),
				],
				layers: [baseLayer],
				code: lambdas.confirmEmailSubscription,
				environment: {
					STACK_NAME: stack.stackName,
					EMAIL_VERIFICATION_TABLE: this.emailVerificationTable.tableName,
				},
			},
		)

		new Logs.LogGroup(this, `confirmEmailSubscriptionLambdaLogGroup`, {
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${confirmEmailSubscriptionLambda.functionName}`,
			retention: Logs.RetentionDays.ONE_WEEK,
		})

		new SNS.Subscription(this, 'ChannelSubscriptionCreatedSubscription', {
			protocol: SNS.SubscriptionProtocol.LAMBDA,
			endpoint: confirmEmailSubscriptionLambda.functionArn,
			topic: eventsTopic,
			filterPolicy: {
				eventName: SNS.SubscriptionFilter.stringFilter({
					whitelist: [EventName.ChannelSubscriptionCreated],
				}),
			},
		})

		confirmEmailSubscriptionLambda.addPermission('InvokeBySNS', {
			principal: new IAM.ServicePrincipal('sns.amazonaws.com'),
			sourceArn: eventsTopic.topicArn,
		})
	}
}