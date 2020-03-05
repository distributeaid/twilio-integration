import * as path from 'path'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { packLayeredLambdasForCloudFormation } from '../packLambdas'

export type TestExtrasLayeredLambdas = LayeredLambdas<{
	sendGridReceiver: string
}>

export const lambdas = async (
	rootDir: string,
	outDir: string,
	Bucket: string,
): Promise<TestExtrasLayeredLambdas> =>
	packLayeredLambdasForCloudFormation('test-extras', outDir, Bucket, {
		sendGridReceiver: path.resolve(
			rootDir,
			'aws',
			'resources',
			'send-grid-receiver-lambda.ts',
		),
	})
