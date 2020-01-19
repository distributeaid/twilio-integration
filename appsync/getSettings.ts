import { SSM } from 'aws-sdk'

const findParameterByName = (Path: string, Parameters?: SSM.ParameterList) => (
	name: string,
): string | undefined =>
	Parameters?.find(({ Name }) => Name?.replace(`${Path}/`, '') === name)?.Value

export const getSettings = async ({
	ssm,
	scope,
}: {
	ssm: SSM
	scope: string
}): Promise<(name: string) => string | undefined> => {
	const Path = `/${scope}`
	const { Parameters } = await ssm
		.getParametersByPath({
			Path,
			Recursive: true,
			WithDecryption: true,
		})
		.promise()

	const f = findParameterByName(Path, Parameters)

	return f
}
