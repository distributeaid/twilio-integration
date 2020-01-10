import { LambdaSourcecodeStorageStack } from './stacks/lambda-sourcecode-storage'
import { SourceCodeStackName } from './app/sourcecode'
import * as fs from 'fs'
import { packBaseLayer } from '@bifravst/package-layered-lambdas'
import { lambdas } from './resources/lambdas'
import { TwilioIntegrationApp } from './app/twilio-integration'
import * as path from 'path'

	; (async () => {
		const outDir = path.resolve(__dirname, '..', '..', 'pack')
		try {
			fs.statSync(outDir)
		} catch (_) {
			fs.mkdirSync(outDir)
		}
		const rootDir = path.resolve(__dirname, '..', '..')

		const Bucket = await LambdaSourcecodeStorageStack.getBucketName(
			SourceCodeStackName,
		)

		const layeredLambdas = await lambdas(rootDir, outDir, Bucket)

		new TwilioIntegrationApp(
			process.env.STACK_NAME,
			Bucket,
			await packBaseLayer({
				srcDir: rootDir,
				outDir,
				Bucket,
			}),
			layeredLambdas,
		).synth()
	})().catch(err => {
		console.error(err.message)
		process.exit(1)
	})
