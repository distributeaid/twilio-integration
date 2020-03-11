import { Construct, RemovalPolicy, Stack, Duration } from '@aws-cdk/core'
import { PolicyStatement, ServicePrincipal } from '@aws-cdk/aws-iam'
import { Code, Function, ILayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs'
import * as SNS from '@aws-cdk/aws-sns'
import { SubscriptionProtocol, SubscriptionFilter } from '@aws-cdk/aws-sns'
import { EventName } from '../../events/events'

export class IntegrationFeature extends Construct {
	constructor(
		stack: Stack,
		id: string,
		lambdas: {
			setUpUserChannelsLambda: Code
		},
		baseLayer: ILayerVersion,
		eventsTopic: SNS.ITopic,
	) {
		super(stack, id)

		const setUpUserChannelsLambda = new Function(
			this,
			`setUpUserChannelsLambda`,
			{
				handler: 'index.handler',
				runtime: Runtime.NODEJS_12_X,
				timeout: Duration.seconds(30),
				memorySize: 1792,
				description:
					'Sets up the user and the permission for their context in Twilio Programmable Chat',
				initialPolicy: [
					new PolicyStatement({
						actions: [
							'logs:CreateLogGroup',
							'logs:CreateLogStream',
							'logs:PutLogEvents',
						],
						resources: [
							`arn:aws:logs:${stack.region}:${stack.account}:/aws/lambda/*`,
						],
					}),
					new PolicyStatement({
						actions: ['ssm:GetParametersByPath'],
						resources: [
							`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/twilio`,
						],
					}),
				],
				layers: [baseLayer],
				code: lambdas.setUpUserChannelsLambda,
				environment: {
					STACK_NAME: stack.stackName,
				},
			},
		)

		new LogGroup(this, `setUpUserChannelsLambdaLogGroup`, {
			removalPolicy: RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${setUpUserChannelsLambda.functionName}`,
			retention: RetentionDays.ONE_WEEK,
		})

		new SNS.Subscription(this, 'ChatTokenCreatedSNSSubscription', {
			protocol: SubscriptionProtocol.LAMBDA,
			endpoint: setUpUserChannelsLambda.functionArn,
			topic: eventsTopic,
			filterPolicy: {
				eventName: SubscriptionFilter.stringFilter({
					whitelist: [EventName.ChatTokenCreated],
				}),
			},
		})

		setUpUserChannelsLambda.addPermission('InvokeBySNS', {
			principal: new ServicePrincipal('sns.amazonaws.com'),
			sourceArn: eventsTopic.topicArn,
		})
	}
}
