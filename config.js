const { readJson } = require("fs-extra");
const { Lazy } = require("lazy-val");
const { join, resolve } = require("path");
const { getConfig } = require("read-config-file");

function getPackageMetadata(projectDir) {
	return new Lazy(() => readJson(join(projectDir, "package.json")));
}

const getElectronWebpackConfiguration = async (context) => {
	const result = await getConfig({
		packageKey: "betterElectronWebpack",
		configFilename: "better-electron-webpack",
		projectDir: context.projectDir,
		packageMetadata: context.packageMetadata,
	});

	const configuration = result == null || result.result == null ? {} : result.result;

	if (configuration.commonDistDirectory == null) {
		configuration.commonDistDirectory = "dist";
	}

	configuration.commonDistDirectory = resolve(context.projectDir, configuration.commonDistDirectory);

	if (configuration.renderer === undefined) {
		configuration.renderer = {};
	}

	if (configuration.main === undefined) {
		configuration.main = {};
	}

	if (configuration.projectDir == null) {
		configuration.projectDir = context.projectDir;
	}

	return configuration;
};

module.exports = {
	getPackageMetadata,
	getElectronWebpackConfiguration,
};
