import * as CDK from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as Logs from '@aws-cdk/aws-logs'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as ApiGateway from '@aws-cdk/aws-apigateway'

/**
 * Development only: provides a REST API to generate chat tokens
 */
export class ChatTokenGeneratorAPI extends CDK.Construct {
	public readonly api: ApiGateway.RestApi

	constructor(
		stack: CDK.Stack,
		id: string,
		{
			generateChatTokenLambda,
			baseLayer,
		}: {
			generateChatTokenLambda: Lambda.Code
			baseLayer: Lambda.ILayerVersion
		},
	) {
		super(stack, id)

		const lambda = new Lambda.Function(this, 'Lambda', {
			description: `Development only: generate chat tokens`,
			code: generateChatTokenLambda,
			layers: [baseLayer],
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
			timeout: CDK.Duration.seconds(15),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['arn:aws:logs:*:*:*'],
					actions: [
						'logs:CreateLogGroup',
						'logs:CreateLogStream',
						'logs:PutLogEvents',
					],
				}),
				new IAM.PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/chat-development`,
					],
				}),
			],
			environment: {
				STACK_NAME: stack.stackName,
			},
		})
		// Create the log group here, so we can control the retention
		new Logs.LogGroup(this, `LambdaLogGroup`, {
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${lambda.functionName}`,
			retention: Logs.RetentionDays.ONE_DAY,
		})

		// This is the API Gateway, AWS CDK automatically creates a prod stage and deployment
		this.api = new ApiGateway.RestApi(this, 'api', {
			restApiName: 'Chat Token Generator',
			description: 'API Gateway to generate chat tokens (development only) ',
		})
		const proxyResource = this.api.root.addResource('{proxy+}')
		proxyResource.addMethod('ANY', new ApiGateway.LambdaIntegration(lambda))
		// API Gateway needs to be able to call the lambda
		lambda.addPermission('InvokeByApiGateway', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: this.api.arnForExecuteApi(),
		})
	}
}
