const { join } = require("path");
const { BaseTarget, configureFileLoader } = require("./BaseTarget");

class MainTarget extends BaseTarget {
	constructor() {
		super();
	}

	configureRules(configurator) {
		super.configureRules(configurator);

		configurator.rules.push({
			test: /\.(png|jpg|gif)$/,
			use: [
				{
					loader: "url-loader",
					// to avoid any issues related to asar, embed any image up to 10MB as data url
					options: configureFileLoader("imgs", 10 * 1024 * 1024),
				},
			],
		});
	}

	async configurePlugins(configurator) {
		await BaseTarget.prototype.configurePlugins.call(this, configurator);

		if (configurator.isProduction) {
			const Obfuscator = require("webpack-obfuscator");

			configurator.plugins.push(
				new Obfuscator({
					target: "node",
					selfDefending: true,
					stringArrayThreshold: 0.5,
					identifierNamesGenerator: "mangled-shuffled",
					disableConsoleOutput: true,
					ignoreRequireImports: true,
					// splitStrings: true,
					// numbersToExpressions: true
				})
			);

			return;
		}

		configurator.entryFiles.push(join(__dirname, "../electron-main-hmr/main-hmr"));
	}
}

module.exports = { MainTarget };
