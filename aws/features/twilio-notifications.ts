import * as CDK from '@aws-cdk/core'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as SNS from '@aws-cdk/aws-sns'
import * as SQS from '@aws-cdk/aws-sqs'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as IAM from '@aws-cdk/aws-iam'
import * as Logs from '@aws-cdk/aws-logs'
import { EventName } from '../../events/events'
import { GQLLambda } from '../../appsync/GQLLambda'
import { ApiFeature } from './api'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'

export const emailVerificationCodeIndex = '07c74665-b990-45e7-b8ef-004d981c44d1'

export class TwilioNotificationFeature extends CDK.Construct {
	public readonly subscriptionsTable: DynamoDB.Table
	public readonly emailVerificationTable: DynamoDB.Table
	public readonly twilioWebhookReceiver: HttpApi.CfnApi

	constructor(
		stack: CDK.Stack,
		id: string,
		isTest: boolean,
		lambdas: {
			sendEmailConfirmationCode: Lambda.Code
			verifyEmailMutation: Lambda.Code
			enableChannelNotificationsMutation: Lambda.Code
			receiveTwilioWebhooks: Lambda.Code
		},
		baseLayer: Lambda.ILayerVersion,
		eventsTopic: SNS.ITopic,
		apiFeature: ApiFeature,
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

		const sendEmailConfirmationCodeLambda = new Lambda.Function(
			this,
			`sendEmailConfirmationCodeLambda`,
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
				code: lambdas.sendEmailConfirmationCode,
				environment: {
					STACK_NAME: stack.stackName,
					EMAIL_VERIFICATION_TABLE: this.emailVerificationTable.tableName,
				},
			},
		)

		new Logs.LogGroup(this, `sendEmailConfirmationCodeLambdaLogGroup`, {
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${sendEmailConfirmationCodeLambda.functionName}`,
			retention: Logs.RetentionDays.ONE_WEEK,
		})

		new SNS.Subscription(this, 'ChannelSubscriptionCreatedSubscription', {
			protocol: SNS.SubscriptionProtocol.LAMBDA,
			endpoint: sendEmailConfirmationCodeLambda.functionArn,
			topic: eventsTopic,
			filterPolicy: {
				eventName: SNS.SubscriptionFilter.stringFilter({
					whitelist: [EventName.ChannelSubscriptionCreated],
				}),
			},
		})

		sendEmailConfirmationCodeLambda.addPermission('InvokeBySNS', {
			principal: new IAM.ServicePrincipal('sns.amazonaws.com'),
			sourceArn: eventsTopic.topicArn,
		})

		// GraphQL

		new GQLLambda(
			this,
			stack,
			baseLayer,
			apiFeature.api,
			apiFeature.schema,
			'enableChannelNotifications',
			'Mutation',
			lambdas.enableChannelNotificationsMutation,
			[
				new IAM.PolicyStatement({
					actions: ['dynamoDb:PutItem'],
					resources: [this.subscriptionsTable.tableArn],
				}),
				new IAM.PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/chat`,
					],
				}),
				new IAM.PolicyStatement({
					actions: ['sns:Publish'],
					resources: [eventsTopic.topicArn],
				}),
			],
			{
				SUBSCRIPTIONS_TABLE: this.subscriptionsTable.tableName,
				SNS_EVENTS_TOPIC: eventsTopic.topicArn,
			},
		)

		new GQLLambda(
			this,
			stack,
			baseLayer,
			apiFeature.api,
			apiFeature.schema,
			'verifyEmail',
			'Mutation',
			lambdas.verifyEmailMutation,
			[
				new IAM.PolicyStatement({
					actions: ['dynamoDb:UpdateItem'],
					resources: [this.emailVerificationTable.tableArn],
				}),
				new IAM.PolicyStatement({
					actions: ['sns:Publish'],
					resources: [eventsTopic.topicArn],
				}),
			],
			{
				EMAIL_VERIFICATION_TABLE: this.emailVerificationTable.tableName,
				SNS_EVENTS_TOPIC: eventsTopic.topicArn,
			},
		)

		// Webhook API for Twilio notifications
		const notificationQueue = new SQS.Queue(this, 'queue', {
			fifo: true,
			queueName: `${`${id}-${stack.stackName}`.substr(0, 75)}.fifo`,
		})

		const receiveTwilioWebhooksLambda = new Lambda.Function(
			this,
			`receiveTwilioWebhooksLambda`,
			{
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CDK.Duration.seconds(30),
				memorySize: 1792,
				description:
					'Receives webhooks requests from Twilio to drive notifications',
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
						resources: [notificationQueue.queueArn],
						actions: ['sqs:SendMessage'],
					}),
					new IAM.PolicyStatement({
						actions: ['ssm:GetParametersByPath'],
						resources: [
							`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/twilio`,
						],
					}),
				],
				environment: {
					SQS_QUEUE: notificationQueue.queueUrl,
					STACK_NAME: stack.stackName,
				},
				layers: [baseLayer],
				code: lambdas.receiveTwilioWebhooks,
			},
		)

		new Logs.LogGroup(this, `receiveTwilioWebhooksLambdaLogGroup`, {
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${receiveTwilioWebhooksLambda.functionName}`,
			retention: Logs.RetentionDays.ONE_WEEK,
		})

		this.twilioWebhookReceiver = new HttpApi.CfnApi(this, 'httpApi', {
			name: 'Twilio Webhook Receiver',
			description: 'API Gateway to receive Twilio webhook requests',
			protocolType: 'HTTP',
			target: receiveTwilioWebhooksLambda.functionArn,
		})

		// API Gateway needs to be able to call the lambda
		receiveTwilioWebhooksLambda.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${this.twilioWebhookReceiver.ref}/*/$default`,
		})
	}
}
