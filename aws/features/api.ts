import { Construct, RemovalPolicy, Stack, Duration } from '@aws-cdk/core'
import { PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam'
import { Code, Function, ILayerVersion, Runtime } from '@aws-cdk/aws-lambda'
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs'
import * as SNS from '@aws-cdk/aws-sns'
import {
	CfnGraphQLApi,
	CfnGraphQLSchema,
	CfnApiKey,
} from '@aws-cdk/aws-appsync'
import { readFileSync } from 'fs'
import * as path from 'path'
import { GQLLambdaResolver } from '../resources/GQLLambdaResolver'

const gqlLambda = (
	parent: Construct,
	stack: Stack,
	baseLayer: ILayerVersion,
	api: CfnGraphQLApi,
	schema: CfnGraphQLSchema,
	field: string,
	type: 'Query' | 'Mutation',
	lambda: Code,
	policies: PolicyStatement[],
	environment?: {
		[key: string]: any
	},
): Function => {
	const f = new Function(parent, `${field}${type}`, {
		handler: 'index.handler',
		runtime: Runtime.NODEJS_12_X,
		timeout: Duration.seconds(30),
		memorySize: 1792,
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
			...policies,
		],
		environment: {
			...environment,
			STACK_NAME: stack.stackName,
		},
		layers: [baseLayer],
		code: lambda,
	})

	new LogGroup(parent, `${field}${type}LogGroup`, {
		removalPolicy: RemovalPolicy.DESTROY,
		logGroupName: `/aws/lambda/${f.functionName}`,
		retention: RetentionDays.ONE_WEEK,
	})

	new GQLLambdaResolver(parent, api, field, type, f).node.addDependency(schema)

	return f
}

export class ApiFeature extends Construct {
	public readonly api: CfnGraphQLApi
	public readonly apiKey: CfnApiKey

	constructor(
		stack: Stack,
		id: string,
		lambdas: {
			createChatTokenMutation: Code
			verifyTokenQuery: Code
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

		const schema = new CfnGraphQLSchema(this, 'Schema', {
			apiId: this.api.attrApiId,
			definition: readFileSync(
				path.resolve(__dirname, '..', '..', '..', 'appsync', 'schema.graphql'),
				'utf-8',
			),
		})

		gqlLambda(
			this,
			stack,
			baseLayer,
			this.api,
			schema,
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

		gqlLambda(
			this,
			stack,
			baseLayer,
			this.api,
			schema,
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
