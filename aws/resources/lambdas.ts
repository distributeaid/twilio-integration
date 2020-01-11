import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type TwilioIntegrationLayeredLambdas = LayeredLambdas<{
	createChatTokenMutation: string
	verifyTokenQuery: string
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
		verifyTokenQuery: path.resolve(
			rootDir,
			'appsync',
			'queries',
			'verifyToken.ts',
		),
	})
