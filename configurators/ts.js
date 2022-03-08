const { join } = require("path");
const { getFirstExistingFile } = require("../util");

async function configureTypescript(configurator) {
	// Add after js
	configurator.extensions.splice(1, 0, ".ts", ".tsx");

	const tsConfigFile = await getFirstExistingFile([
		join(configurator.sourceDir, "tsconfig.json"),
		join(configurator.projectDir, "tsconfig.json"),
	]);

	if (tsConfigFile == null) throw new Error(`Please create a tsconfig.json file`);

	configurator.rules.push({
		test: /\.tsx?$/,
		exclude: /node_modules/,
		use: [
			{
				loader: "ts-loader",
				options: {
					transpileOnly: !configurator.isProduction,
					configFile: tsConfigFile,
				},
			},
		],
	});
}

module.exports = { configureTypescript };
