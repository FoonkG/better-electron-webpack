const chalk = require("chalk");

function filterText(log, lineFilter) {
	const trimmedLog = log.trim();
	if (trimmedLog === "") return null;

	const lines = trimmedLog.split(/\r?\n/).filter((it) => {
		if (lineFilter != null && !lineFilter.filter(it)) {
			return false;
		}

		return (
			!it.includes("Warning: This is an experimental feature and could change at any time.") &&
			!it.includes("No type errors found") &&
			!it.includes("webpack: Compiled successfully.")
		);
	});

	if (lines.length === 0) return null;

	return "  " + lines.join(`\n  `) + "\n";
}

function logProcessErrorOutput(label, childProcess) {
	childProcess.stderr.on("data", (data) => {
		logProcess(label, data.toString(), chalk.red);
	});
}

function logError(label, error) {
	logProcess(label, error.stack || error.toString(), chalk.red);
}

const LABEL_LENGTH = 35;

function logProcess(label, data, labelColor, lineFilter = null) {
	const log = filterText(data.toString(), lineFilter);
	if (log == null || log.length === 0) return;

	process.stdout.write(
		labelColor.bold(`┏ ${label} ${"-".repeat(LABEL_LENGTH - label.length - 1)}`) +
			"\n\n" +
			data.toString() +
			"\n" +
			labelColor.bold(`┗ ${"-".repeat(LABEL_LENGTH)}`) +
			"\n"
	);
}

class DelayedFunction {
	constructor(executor) {
		this.handle = null;

		this.executor = () => {
			this.handle = null;
			executor();
		};
	}

	schedule() {
		this.cancel();
		this.handle = setTimeout(this.executor, 5000);
	}

	cancel() {
		const handle = this.handle;
		if (handle != null) {
			this.handle = null;
			clearTimeout(handle);
		}
	}
}

function getCommonEnv() {
	return {
		...process.env,
		NODE_ENV: "development",
		// to force debug colors in the child process
		DEBUG_COLORS: true,
		DEBUG_FD: "1",
	};
}

module.exports = { logProcessErrorOutput, logError, logProcess, getCommonEnv, DelayedFunction };
