function createBabelLoader(configurator) {
	const presets = [
		[
			require("@babel/preset-env").default,
			{
				modules: false,
				targets: computeBabelEnvTarget(configurator.isRenderer, configurator.electronVersion),
			},
		],
		[
			"minify",
			{
				builtIns: false,
				evaluate: false,
				mangle: false,
			},
		],
	];
	const plugins = [require("@babel/plugin-syntax-dynamic-import").default];

	addBabelItem(
		presets,
		configurator.getMatchingDevDependencies({
			includes: ["babel-preset-", "@babel/preset-"],
			excludes: ["babel-preset-env", "@babel/preset-env", "babel-preset-minify"],
		})
	);
	addBabelItem(
		plugins,
		configurator.getMatchingDevDependencies({
			includes: ["babel-plugin-", "@babel/plugin-"],
			excludes: ["babel-plugin-syntax-dynamic-import", "@babel/plugin-syntax-dynamic-import"],
		})
	);

	return {
		loader: "babel-loader",
		options: {
			presets,
			plugins,
		},
	};
}

module.exports = { createBabelLoader };

function addBabelItem(to, names) {
	for (const name of names) {
		const module = require(name);
		to.push([module.default || module]);
	}
}

function computeBabelEnvTarget(isRenderer, electronVersion) {
	if (isRenderer) {
		return {
			electron: electronVersion,
		};
	}

	return {
		node: process.version.replace("v", ""),
	};
}
