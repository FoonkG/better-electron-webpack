const { outputFile } = require("fs-extra");
const { Lazy } = require("lazy-val");
const path = require("path");
const { getConfig } = require("read-config-file");
const { BaseTarget, configureFileLoader } = require("./BaseTarget");

const MiniCssExtractPlugin = require("mini-css-extract-plugin");

class BaseRendererTarget extends BaseTarget {
	constructor() {
		super();
	}

	configureRules(configurator) {
		super.configureRules(configurator);

		configurator.extensions.push(".css");

		configurator.rules.push(
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, { loader: "css-loader", options: { modules: "global" } }],
			},
			{
				test: /\.(png|jpe?g|gif)(\?.*)?$/,
				use: {
					loader: "url-loader",
					options: configureFileLoader("imgs"),
				},
			},
			{
				test: /\.svg$/,
				use: [
					{
						loader: "@svgr/webpack",
						options: {
							svgoConfig: {
								plugins: {
									removeViewBox: false,
									reusePaths: true,
								},
							},
						},
					},
					{
						loader: "url-loader",
						options: configureFileLoader("imgs"),
					},
				],
			},
			{
				test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
				loader: "url-loader",
				options: configureFileLoader("media"),
			},
			{
				test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
				use: {
					loader: "url-loader",
					options: configureFileLoader("fonts"),
				},
			}
		);
	}

	async configurePlugins(configurator) {
		configurator.plugins.push(
			new MiniCssExtractPlugin({
				filename: `styles.css`,
			})
		);

		await BaseTarget.prototype.configurePlugins.call(this, configurator);
	}
}

class RendererTarget extends BaseRendererTarget {
	constructor() {
		super();
	}

	async configurePlugins(configurator) {
		const HtmlWebpackPlugin = require("html-webpack-plugin");
		const nodeModulePath = configurator.isProduction ? null : path.resolve(require.resolve("electron"), "..", "..");

		let template = getDefaultIndexTemplate();

		configurator.plugins.push(
			new HtmlWebpackPlugin({
				filename: "index.html",
				template: await generateIndexFile(configurator, nodeModulePath, template),
				minify: "auto",
				nodeModules: nodeModulePath,
			})
		);

		if (!configurator.isProduction) {
			configurator.config.devServer = {
				host: process.env.ELECTRON_WEBPACK_WDS_HOST || "localhost",
				port: process.env.ELECTRON_WEBPACK_WDS_PORT || 9080,
				hot: true,
				overlay: true,
			};
		}

		await BaseRendererTarget.prototype.configurePlugins.call(this, configurator);
	}
}

module.exports = {
	BaseRendererTarget,
	RendererTarget,
};

async function computeTitle(configurator) {
	let title = configurator.metadata.productName;

	if (title == null) {
		const electronBuilderConfig = await getConfig({
			packageKey: "build",
			configFilename: "electron-builder",
			projectDir: configurator.projectDir,
			packageMetadata: new Lazy(() => Promise.resolve(configurator.metadata)),
		});

		if (electronBuilderConfig != null) {
			title = electronBuilderConfig.result.productName;
		}
	}

	if (title == null) {
		title = configurator.metadata.name;
	}

	return title;
}

function getDefaultIndexTemplate() {
	return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <div id="app"></div>
      </body>
    </html>`;
}

async function generateIndexFile(configurator, nodeModulePath, html) {
	const scripts = [];
	const css = [];

	const title = await computeTitle(configurator);
	const filePath = path.join(configurator.commonDistDirectory, "index.html");

	if (title) {
		html = html.replace("</head>", `<title>${title}</title></head>`);
	}

	if (nodeModulePath) {
		html = html.replace("</head>", `<script>require('module').globalPaths.push("${nodeModulePath.replace(/\\/g, "/")}")</script></head>`);
	}

	if (scripts.length) {
		html = html.replace("</head>", `${scripts.join("")}</head>`);
	}

	if (css.length) {
		html = html.replace("</head>", `${css.join("")}</head>`);
	}

	await outputFile(filePath, html);

	return filePath;
}
