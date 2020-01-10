import { TwilioIntegrationSourceCodeApp } from './app/sourcecode'

	; (async () => {
		new TwilioIntegrationSourceCodeApp().synth()
	})().catch(err => {
		console.error(err.message)
		process.exit(1)
	})
