const { DefinePlugin, HotModuleReplacementPlugin } = require("webpack");
const { createBabelLoader } = require("../configurators/js");

class BaseTarget {
	configureRules(configurator) {
		const babelLoader = createBabelLoader(configurator);

		configurator.rules.push(
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: babelLoader,
			},
			{
				test: /\.html$/,
				use: {
					loader: "html-loader",
				},
			}
		);
	}

	async configurePlugins(configurator) {
		const plugins = configurator.plugins;

		const mode = configurator.isProduction ? "production" : "development";

		let optimization = configurator.config.optimization || {};

		optimization.nodeEnv = mode;
		configurator.config.mode = mode;

		plugins.push(
			new DefinePlugin({
				"process.env.NODE_ENV": configurator.isProduction ? '"production"' : '"development"',
			})
		);

		if (configurator.isProduction) {
			const TerserPlugin = require("terser-webpack-plugin");

			optimization.minimize = true;
			optimization.minimizer = [
				new TerserPlugin({
					terserOptions: {
						format: {
							comments: false,
						},
					},
					extractComments: false,
				}),
			];
		} else {
			plugins.push(new HotModuleReplacementPlugin());
		}

		optimization.emitOnErrors = true;
	}
}

function configureFileLoader(prefix, limit = 10 * 1024) {
	return {
		limit,
		name: `${prefix}/[name]--[folder].[ext]`,
	};
}

module.exports = {
	BaseTarget,
	configureFileLoader,
};
