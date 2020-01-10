import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type TwilioIntegrationLayeredLambdas = LayeredLambdas<{
	createChatTokenMutation: string
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
	})
