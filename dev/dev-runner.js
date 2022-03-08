const BluebirdPromise = require("bluebird");
const chalk = require("chalk");
const { spawn } = require("child_process");
const { readdir, remove } = require("fs-extra");
const path = require("path");
const webpack = require("webpack");
const { getElectronWebpackConfiguration, getPackageMetadata } = require("../config");
const { HmrServer } = require("../electron-main-hmr/HmrServer");
const { configure } = require("../main");
const { orNullIfFileNotExist } = require("../util");
const { DelayedFunction, getCommonEnv, logError, logProcess, logProcessErrorOutput } = require("./devUtil");
const { startRenderer } = require("./WebpackDevServerManager");
const getFreePort = require("get-port");

const projectDir = process.cwd();

let socketPath = null;

// do not remove main.js to allow IDE to keep breakpoints
async function emptyMainOutput() {
	const electronWebpackConfig = await getElectronWebpackConfiguration({
		projectDir,
		packageMetadata: getPackageMetadata(projectDir),
	});

	const outDir = path.join(electronWebpackConfig.commonDistDirectory, "main");
	const files = await orNullIfFileNotExist(readdir(outDir));
	if (files == null) return;

	await BluebirdPromise.map(
		files.filter((it) => !it.startsWith(".") && it !== "main.js"),
		(it) => remove(outDir + path.sep + it)
	);
}

class DevRunner {
	async start() {
		const wdsPort = await getFreePort({ port: 9080 });

		const env = {
			...getCommonEnv(),
			ELECTRON_WEBPACK_WDS_HOST: "localhost",
			ELECTRON_WEBPACK_WDS_PORT: wdsPort,
		};

		const hmrServer = new HmrServer();
		await Promise.all([
			startRenderer(projectDir, env),
			hmrServer.listen().then((it) => {
				socketPath = it;
			}),
			emptyMainOutput().then(() => this.startMainCompilation(hmrServer)),
		]);

		hmrServer.ipc.on("error", (error) => {
			logError("Main", error);
		});

		const electronArgs = process.env.ELECTRON_ARGS;
		const args = electronArgs != null && electronArgs.length > 0 ? JSON.parse(electronArgs) : [`--inspect=${wdsPort}`];
		args.push(path.join(projectDir, "dist/main/main.js"));

		// Pass remaining arguments to the application. Remove 3 instead of 2, to remove the `dev` argument as well.
		args.push(...process.argv.slice(3));

		// we should start only when both start and main are started
		startElectron(args, env);
	}

	async startMainCompilation(hmrServer) {
		const mainConfig = await configure("main", {
			production: false,
		});

		await new Promise((resolve, reject) => {
			const compiler = webpack(mainConfig);

			const printCompilingMessage = new DelayedFunction(() => {
				logProcess("Main", "Compiling...", chalk.yellow);
			});

			compiler.hooks.compile.tap("better-electron-webpack-dev-runner", () => {
				hmrServer.beforeCompile();
				printCompilingMessage.schedule();
			});

			let watcher = compiler.watch({}, (error, stats) => {
				printCompilingMessage.cancel();

				if (watcher == null) return;

				if (error != null) {
					if (reject == null) {
						logError("Main", error);
					} else {
						reject(error);
						reject = null;
					}
					return;
				}

				logProcess(
					"Main",
					stats.toString({
						colors: true,
					}),
					chalk.yellow
				);

				if (resolve != null) {
					resolve();
					resolve = null;
					return;
				}

				hmrServer.built(stats);
			});

			require("async-exit-hook")((callback) => {
				const w = watcher;
				if (w == null) return;

				watcher = null;
				w.close(() => callback());
			});
		});
	}
}

async function main() {
	const devRunner = new DevRunner();
	await devRunner.start();
}

main().catch((error) => {
	console.error(error);
});

function startElectron(electronArgs, env) {
	const electronProcess = spawn(require("electron").toString(), electronArgs, {
		env: {
			...env,
			ELECTRON_HMR_SOCKET_PATH: socketPath,
		},
	});

	// required on windows
	require("async-exit-hook")(() => {
		electronProcess.kill("SIGINT");
	});

	let queuedData = null;
	electronProcess.stdout.on("data", (data) => {
		data = data.toString();
		// do not print the only line - doesn't make sense
		if (data.trim() === "[HMR] Updated modules:") {
			queuedData = data;
			return;
		}

		if (queuedData != null) {
			data = queuedData + data;
			queuedData = null;
		}

		logProcess("Electron", data, chalk.blue);
	});

	logProcessErrorOutput("Electron", electronProcess);

	electronProcess.on("close", (exitCode) => {
		console.error(`Electron exited with exit code ${exitCode}`);
		if (exitCode === 100) {
			setImmediate(() => {
				startElectron(electronArgs, env);
			});
		} else {
			process.emit("message", "shutdown");
		}
	});
}
