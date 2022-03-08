const BluebirdPromise = require("bluebird");
const { readJson } = require("fs-extra");
const { Lazy } = require("lazy-val");
const path = require("path");
const { deepAssign } = require("read-config-file/out/deepAssign");
const merge = require("webpack-merge");

const { getElectronWebpackConfiguration, getPackageMetadata } = require("./config");
const { configureTypescript } = require("./configurators/ts");
const { getFirstExistingFile } = require("./util");

const { MainTarget } = require("./targets/MainTarget");
const { RendererTarget } = require("./targets/RendererTarget");

function getAppConfiguration() {
	return BluebirdPromise.filter([configure("main"), configure("renderer")], (it) => it != null);
}

function getRendererConfiguration() {
	return configure("renderer");
}

class WebpackConfigurator {
	constructor(type, env, electronWebpackConfiguration, metadata) {
		this.type = type;
		this.env = env;
		this.electronWebpackConfiguration = electronWebpackConfiguration;
		this.metadata = metadata;
		this.electronVersionPromise = new Lazy(() => getInstalledElectronVersion(this.projectDir));

		this._configuration = null;
		this.rules = [];
		this.plugins = [];

		this.extensions = [".js", ".json"];
		this._electronVersion = null;
		this.entryFiles = [];

		if (metadata.dependencies == null) {
			metadata.dependencies = {};
		}

		if (metadata.devDependencies == null) {
			metadata.devDependencies = {};
		}

		this.isRenderer = type.startsWith("renderer");
		this.isProduction = this.env.production == null ? process.env.NODE_ENV === "production" : this.env.production;

		this.projectDir = electronWebpackConfiguration.projectDir;
		this.sourceDir = this.getSourceDirectory(this.type);
		this.commonDistDirectory = this.electronWebpackConfiguration.commonDistDirectory;

		process.env.BABEL_ENV = type;
	}

	get config() {
		return this._configuration;
	}

	get electronVersion() {
		return this._electronVersion;
	}

	getSourceDirectory(type) {
		return path.join(this.projectDir, "src", this.isRenderer ? "renderer" : type);
	}

	hasDevDependency(name) {
		return name in this.metadata.devDependencies;
	}

	/**
	 * Returns the names of devDependencies that match a given string or regex.
	 * If no matching dependencies are found, an empty array is returned.
	 *
	 * @return list of matching dependency names, e.g. `["@babel/preset-react", "@babel/preset-stage-0"]`
	 */
	getMatchingDevDependencies(options) {
		const includes = options.includes || [];
		const excludes = new Set(options.excludes || []);
		return Object.keys(this.metadata.devDependencies).filter(
			(name) => !excludes.has(name) && includes.some((prefix) => name.startsWith(prefix))
		);
	}

	async configure() {
		this._configuration = {
			context: this.projectDir,
			devtool: false,
			externals: this.computeExternals(),
			node: {
				__dirname: !this.isProduction,
				__filename: !this.isProduction,
			},
			output: {
				filename: "[name].js",
				chunkFilename: "[name].bundle.js",
				libraryTarget: "commonjs2",
				path: path.join(this.commonDistDirectory, this.type),
			},
			target: `electron-${this.type}`,
			resolve: {
				alias: {
					"@": this.sourceDir,
				},
				extensions: this.extensions,
			},
			module: {
				rules: this.rules,
			},
			plugins: this.plugins,
		};

		this._electronVersion = await this.electronVersionPromise.value;

		const target = (() => {
			switch (this.type) {
				case "renderer":
					return new RendererTarget();
				case "main":
					return new MainTarget();
			}
		})();

		target.configureRules(this);
		await Promise.all([target.configurePlugins(this), configureTypescript(this)]);

		if (this.config.entry == null) {
			this.entryFiles.push(await computeEntryFile(this.sourceDir, this.projectDir));
			this.config.entry = {
				[this.type]: this.entryFiles,
			};

			const mainConfiguration = this.electronWebpackConfiguration.main || {};

			let extraEntries = mainConfiguration.extraEntries;
			if (this.type === "main" && extraEntries != null) {
				if (typeof extraEntries === "string") {
					extraEntries = [extraEntries];
				}

				if (Array.isArray(extraEntries)) {
					for (const p of extraEntries) {
						this.config.entry[path.basename(p, path.extname(p))] = p;
					}
				} else {
					Object.assign(this.config.entry, extraEntries);
				}
			}
		}

		this._configuration = await this.applyCustomModifications(this.config);

		return this.config;
	}

	applyCustomModifications(config) {
		const { renderer, main } = this.electronWebpackConfiguration;

		const applyCustom = (configPath) => {
			const customModule = require(path.join(this.projectDir, configPath));
			if (typeof customModule === "function") {
				return customModule(config, this);
			} else {
				return merge.smart(config, customModule);
			}
		};

		if (this.type === "renderer" && renderer && renderer.webpackConfig) {
			return applyCustom(renderer.webpackConfig);
		} else if (this.type === "main" && main && main.webpackConfig) {
			return applyCustom(main.webpackConfig);
		} else {
			return config;
		}
	}

	computeExternals() {
		const whiteListedModules = new Set(this.electronWebpackConfiguration.whiteListedModules || []);
		if (this.isRenderer) {
			whiteListedModules.add("react");
			whiteListedModules.add("react-dom");
		}

		const filter = (name) => !name.startsWith("@types/") && (whiteListedModules == null || !whiteListedModules.has(name));

		const externals = Object.keys(this.metadata.dependencies).filter(filter);
		externals.push("electron");
		externals.push("webpack");

		if (this.type === "main") {
			externals.push("webpack/hot/log-apply-result");
			externals.push("better-electron-webpack/electron-main-hmr/HmrClient");
		}

		if (this.electronWebpackConfiguration.externals != null) {
			return externals.concat(this.electronWebpackConfiguration.externals);
		}

		return externals;
	}
}

async function createConfigurator(type, env) {
	if (env != null) {
		const _env = env;
		for (const name of ["minify", "production"]) {
			if (_env[name] === "true") {
				_env[name] = true;
			} else if (_env[name] === "false") {
				_env[name] = false;
			}
		}
	}

	if (env == null) env = {};

	const projectDir = (env.configuration || {}).projectDir || process.cwd();
	const packageMetadata = getPackageMetadata(projectDir);
	const electronWebpackConfig = await getElectronWebpackConfiguration({
		packageMetadata,
		projectDir,
	});

	if (env.configuration != null) deepAssign(electronWebpackConfig, env.configuration);

	return new WebpackConfigurator(type, env, electronWebpackConfig, await packageMetadata.value);
}

async function configure(type, env) {
	const configurator = await createConfigurator(type, env);

	return await configurator.configure();
}

module.exports = {
	getAppConfiguration,
	getRendererConfiguration,
	WebpackConfigurator,
	createConfigurator,
	configure,
};

async function computeEntryFile(srcDir) {
	const candidates = [];
	for (const ext of ["ts", "js", "tsx", "jsx"]) {
		for (const name of ["index", "main", "app"]) {
			candidates.push(`${name}.${ext}`);
		}
	}

	const file = await getFirstExistingFile(candidates, srcDir);
	if (file == null) {
		throw new Error(`Cannot find entry file index.ts (or main.ts, or app.ts, or index.js, or main.js, or app.js)`);
	}

	return file;
}

async function getInstalledElectronVersion(projectDir) {
	try {
		return (await readJson(path.join(projectDir, "node_modules", "electron", "package.json"))).version;
	} catch (e) {
		if (e.code !== "ENOENT") {
			throw e;
		}
	}
}
