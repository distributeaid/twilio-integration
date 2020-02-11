import { S3 } from 'aws-sdk'
import * as fs from 'fs'
import * as path from 'path'

const s3 = new S3({ region: process.env.AWS_DEFAULT_REGION })
const keyId = process.env.KEY_ID
const Bucket = process.env.WEBSITE_BUCKET as string

console.log(`Publishing key ${keyId} to ${Bucket}`)

s3.putObject({
	Bucket,
	Key: '.well-known/jwks.json',
	Body: JSON.stringify({
		keys: [
			{
				alg: 'ES256',
				kid: keyId,
				use: 'sig',
				key: fs
					.readFileSync(
						path.join(process.cwd(), `ecdsa-p256-${keyId}-public.pem`),
					)
					.toString(),
			},
		],
	}),
	ContentType: 'application/json',
})
	.promise()
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
