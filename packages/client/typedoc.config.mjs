export default {
	entryPoints: [
		'./src/client.ts',
		'./src/types.ts',
	],
	exclude: [
		'**/*spec.ts',
		'node_modules/**'
	],
	excludeNotDocumented: true,
	navigationLinks: {
    Repository: 'https://github.com/sodazone/xcm-monitoring/tree/main/packages/client',
		'SO/DA zone': 'https://soda.zone/'
    },
	includeVersion: true,
	excludeExternals: true,
	excludePrivate: true,
	hideGenerator: true,
	out: 'docs',
};