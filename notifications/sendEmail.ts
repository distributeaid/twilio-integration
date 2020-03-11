import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../appsync/ErrorInfo'
import fetch from 'node-fetch'

export const sendEmail = ({
	apiKey,
	from,
}: {
	apiKey: string
	from: {
		email: string
		name: string
	}
}) => ({
	to,
	subject,
	text,
}: {
	to: {
		email: string
		name?: string
	}
	subject: string
	text: string
}): TE.TaskEither<ErrorInfo, void> =>
	TE.tryCatch<ErrorInfo, void>(
		async () => {
			const res = await fetch(`https://api.sendgrid.com/v3/mail/send`, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
				body: JSON.stringify({
					personalizations: [
						{
							to: [
								{
									email: to.email,
									...(to.name ? { name: to.name } : {}),
								},
							],
							subject,
						},
					],
					from,
					content: [
						{
							type: 'text/plain',
							value: text,
						},
					],
				}),
			})
			if (res.status >= 400) {
				const body = await res.text()
				throw new Error(`Failed to send email: (${res.status}) ${body}`)
			}
		},
		err => {
			console.error(
				JSON.stringify({
					sendEmail: { error: (err as Error).message, to, subject, text },
				}),
			)
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)
