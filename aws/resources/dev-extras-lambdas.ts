import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type DevExtrasLayeredLambdas = LayeredLambdas<{
	generateChatToken: string
}>

export const lambdas = async (
	rootDir: string,
	outDir: string,
	Bucket: string,
): Promise<DevExtrasLayeredLambdas> =>
	packLayeredLambdasForCloudFormation('dev-extras', outDir, Bucket, {
		generateChatToken: path.resolve(
			rootDir,
			'aws',
			'resources',
			'generate-chat-token-lambda.ts',
		),
	})
