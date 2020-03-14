import { Construct, RemovalPolicy, Stack } from '@aws-cdk/core'
import { PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam'
import { Code, ILayerVersion } from '@aws-cdk/aws-lambda'
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs'
import * as SNS from '@aws-cdk/aws-sns'
import {
	CfnGraphQLApi,
	CfnGraphQLSchema,
	CfnApiKey,
} from '@aws-cdk/aws-appsync'
import { readFileSync } from 'fs'
import * as path from 'path'
import { GQLLambda } from '../../appsync/GQLLambda'

export class ApiFeature extends Construct {
	public readonly api: CfnGraphQLApi
	public readonly apiKey: CfnApiKey
	public readonly schema: CfnGraphQLSchema

	constructor(
		stack: Stack,
		id: string,
		lambdas: {
			createChatTokenMutation: Code
			verifyTokenQuery: Code
			verifyEmailMutation: Code
		},
		baseLayer: ILayerVersion,
		eventsTopic: SNS.ITopic,
	) {
		super(stack, id)

		const apiRole = new Role(this, 'Role', {
			assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
		})
		apiRole.addToPolicy(
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
		)

		this.api = new CfnGraphQLApi(this, 'Api', {
			name: 'TwilioIntegration',
			authenticationType: 'API_KEY',
			logConfig: {
				fieldLogLevel: 'ALL',
				cloudWatchLogsRoleArn: apiRole.roleArn,
			},
		})

		new LogGroup(this, 'LogGroup', {
			removalPolicy: RemovalPolicy.DESTROY,
			logGroupName: `/aws/appsync/apis/${this.api.attrApiId}`,
			retention: RetentionDays.ONE_WEEK,
		})

		this.schema = new CfnGraphQLSchema(this, 'Schema', {
			apiId: this.api.attrApiId,
			definition: readFileSync(
				path.resolve(__dirname, '..', '..', '..', 'appsync', 'schema.graphql'),
				'utf-8',
			),
		})

		new GQLLambda(
			this,
			stack,
			baseLayer,
			this.api,
			this.schema,
			'createChatToken',
			'Mutation',
			lambdas.createChatTokenMutation,
			[
				new PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/twilio`,
						`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/chat`,
					],
				}),
				new PolicyStatement({
					actions: ['sns:Publish'],
					resources: [eventsTopic.topicArn],
				}),
			],
			{
				SNS_EVENTS_TOPIC: eventsTopic.topicArn,
			},
		)

		new GQLLambda(
			this,
			stack,
			baseLayer,
			this.api,
			this.schema,
			'verifyToken',
			'Query',
			lambdas.verifyTokenQuery,
			[
				new PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/chat`,
					],
				}),
			],
		)

		const year = new Date().getFullYear()
		this.apiKey = new CfnApiKey(this, `apiKey${year}`, {
			apiId: this.api.attrApiId,
			description: `API key for ${year}`,
			expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
		})
	}
}
