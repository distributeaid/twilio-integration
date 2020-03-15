import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type TwilioIntegrationLayeredLambdas = LayeredLambdas<{
	createChatTokenMutation: string
	verifyTokenQuery: string
	setUpUserChannels: string
	enableChannelNotificationsMutation: string
	verifyEmailMutation: string
	sendEmailConfirmationCode: string
	sendEmailNotifications: string
	receiveTwilioWebhooks: string
}>

export const lambdas = async (
	rootDir: string,
	outDir: string,
	Bucket: string,
): Promise<TwilioIntegrationLayeredLambdas> =>
	packLayeredLambdasForCloudFormation('twilio-integration', outDir, Bucket, {
		createChatTokenMutation: path.resolve(
			rootDir,
			'appsync',
			'mutations',
			'createChatToken.ts',
		),
		enableChannelNotificationsMutation: path.resolve(
			rootDir,
			'appsync',
			'mutations',
			'enableChannelNotifications.ts',
		),
		verifyEmailMutation: path.resolve(
			rootDir,
			'notifications',
			'lambda',
			'verifyEmailMutation.ts',
		),
		verifyTokenQuery: path.resolve(
			rootDir,
			'appsync',
			'queries',
			'verifyToken.ts',
		),
		setUpUserChannels: path.resolve(
			rootDir,
			'integration',
			'setUpUserChannels.ts',
		),
		sendEmailConfirmationCode: path.resolve(
			rootDir,
			'notifications',
			'lambda',
			'sendEmailConfirmationCode.ts',
		),
		sendEmailNotifications: path.resolve(
			rootDir,
			'notifications',
			'lambda',
			'sendEmailNotifications.ts',
		),
		receiveTwilioWebhooks: path.resolve(
			rootDir,
			'notifications',
			'lambda',
			'receiveTwilioWebhooks.ts',
		),
	})
