export default {
	entryPoints: [
		'./src/client.ts',
		'./src/types.ts',
	],
  entryPointStrategy: 'Expand',
  navigationLinks: {
    Repository: 'https://github.com/sodazone/xcm-monitoring/tree/main/packages/client',
		'SO/DA zone': 'https://soda.zone/'
  },
	exclude: [
		'**/*spec.ts',
		'node_modules/**'
	],
	excludeNotDocumented: true,
	includeVersion: true,
	excludeExternals: true,
	excludePrivate: true,
	hideGenerator: true,
	out: 'docs',
};