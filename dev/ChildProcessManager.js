class ChildProcessManager {
	constructor(child, debugLabel, promiseNotifier) {
		this.mainProcessExitCleanupCallback = null;
		this.child = child;

		require("async-exit-hook")((callback) => {
			this.mainProcessExitCleanupCallback = callback;

			const child = this.child;
			if (child == null) return;

			this.child = null;

			if (promiseNotifier != null) {
				promiseNotifier.resolve();
			}

			child.kill("SIGINT");
		});

		child.on("close", (code) => {
			const mainProcessExitCleanupCallback = this.mainProcessExitCleanupCallback;
			if (mainProcessExitCleanupCallback != null) {
				this.mainProcessExitCleanupCallback = null;
				mainProcessExitCleanupCallback();
			}

			const child = this.child;
			if (child == null) return;

			this.child = null;

			const message = `${debugLabel} exited with code ${code}`;

			if (promiseNotifier != null) {
				promiseNotifier.reject(new Error(message));
			}

			if (code !== 0) process.stderr.write(`${message}\n`);
		});
	}
}

class PromiseNotifier {
	constructor(_resolve, _reject) {
		this._resolve = _resolve;
		this._reject = _reject;
	}

	resolve() {
		const r = this._resolve;
		if (r != null) {
			this._resolve = null;
			r();
		}
	}

	reject(error) {
		if (this._resolve != null) {
			this._resolve = null;
		}

		const _reject = this._reject;
		if (_reject != null) {
			this._reject = null;
			_reject(error);
		}
	}
}

module.exports = { ChildProcessManager, PromiseNotifier };
