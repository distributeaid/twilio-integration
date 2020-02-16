import * as jwt from 'jsonwebtoken'
import * as fs from 'fs'
import * as path from 'path'
import * as chalk from 'chalk'

const keyid = process.argv[process.argv.length - 2]
const identity = process.argv[process.argv.length - 1]

const privateKey = fs.readFileSync(
	path.join(process.cwd(), `ecdsa-p256-${keyid}-private.pem`),
	'utf-8',
)
const opts: jwt.SignOptions = {
	algorithm: 'ES256',
	expiresIn: 24 * 60 * 60,
	subject: identity,
	keyid,
}
const payload = { contexts: ['general'] }

console.log(chalk.yellow('JWT Options:'))
console.log(chalk.magenta(JSON.stringify(opts, null, 2)))
console.log()

console.log(chalk.yellow('JWT Payload:'))
console.log(chalk.magenta(JSON.stringify(payload, null, 2)))
console.log()

console.log(chalk.yellow('Token:'))
const token = jwt.sign(payload, privateKey, opts)
console.log(chalk.blue(token))
console.log('')

const cert = fs
	.readFileSync(
		path.join(process.cwd(), `ecdsa-p256-${keyid}-public.pem`),
		'utf-8',
	)
	.trim()
console.log(chalk.yellow('Public key:'))
console.log(chalk.blue(cert))
console.log('')

console.log(chalk.yellow('.well-known/jwks.json'))
console.log(
	chalk.blue(
		JSON.stringify(
			{
				keys: [
					{
						alg: 'ES256',
						kid: keyid,
						use: 'sig',
						key: cert,
					},
				],
			},
			null,
			2,
		),
	),
)
console.log('')

jwt.verify(token, cert, (err: jwt.VerifyErrors) => {
	if (err) {
		console.error(chalk.red(err))
		process.exit(1)
	}
	console.log(chalk.green('OK'))
})
