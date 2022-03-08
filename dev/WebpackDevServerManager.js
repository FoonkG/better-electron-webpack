const chalk = require("chalk");
const path = require("path");
const { spawn } = require("child_process");

const { createConfigurator } = require("../main");
const { statOrNull } = require("../util");
const { ChildProcessManager, PromiseNotifier } = require("./ChildProcessManager");
const { logError, logProcess, logProcessErrorOutput } = require("./devUtil");

function runWds(projectDir, env) {
	const isWin = process.platform === "win32";

	return spawn(
		"webpack-dev-server" + (isWin ? ".cmd" : ""),
		["--color", "--config", path.join(__dirname, "../webpack.renderer.config.js")],
		{
			env,
			cwd: projectDir,
		}
	);
}

// 1. in another process to speedup compilation
// 2. some loaders detect webpack-dev-server hot mode only if run as CLI
async function startRenderer(projectDir, env) {
	const webpackConfigurator = await createConfigurator("renderer", { production: false, configuration: { projectDir } });
	const sourceDir = webpackConfigurator.sourceDir;

	// explicitly set to null - do not handle at all and do not show info message
	if (sourceDir === null) return;

	const dirStat = await statOrNull(sourceDir);
	if (dirStat == null || !dirStat.isDirectory()) {
		logProcess("Renderer", `No renderer source directory (${path.relative(projectDir, sourceDir)})`, chalk.blue);
		return;
	}

	return await new Promise((resolve, reject) => {
		let devServerProcess;

		try {
			devServerProcess = runWds(projectDir, env);
		} catch (e) {
			reject(e);
			return;
		}

		new ChildProcessManager(devServerProcess, "Renderer WDS", new PromiseNotifier(resolve, reject));
		devServerProcess.on("error", (error) => {
			if (reject == null) {
				logError("Renderer", error);
			} else {
				reject(error);
				reject = null;
			}
		});

		devServerProcess.stdout.on("data", (data) => {
			logProcess("Renderer", data, chalk.blue);

			const r = resolve;
			// we must resolve only after compilation, otherwise devtools disconnected
			if (r != null && (data.includes(": Compiled successfully.") || data.includes(": Compiled with warnings."))) {
				resolve = null;
				r();
			}
		});

		logProcessErrorOutput("Renderer", devServerProcess);
	});
}

module.exports = { startRenderer };
