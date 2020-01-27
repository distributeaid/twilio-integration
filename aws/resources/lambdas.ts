import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type TwilioIntegrationLayeredLambdas = LayeredLambdas<{
	createChatTokenMutation: string
	updateNickMutation: string
	verifyTokenQuery: string
	setUpUserChannels: string
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
		updateNickMutation: path.resolve(
			rootDir,
			'appsync',
			'mutations',
			'updateNick.ts',
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
	})
