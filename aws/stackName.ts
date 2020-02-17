export const stackName = (extension?: 'sourcecode' | 'test-extras') => {
	let name = process.env.STACK_NAME || 'twilio-integration-dev'
	if (extension) name = `${name}-${extension}`
	return name
}
