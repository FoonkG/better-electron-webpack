const Crocket = require("crocket");

class HmrServer {
	constructor() {
		this.state = false;
		this.ipc = new Crocket();
	}

	listen() {
		return new Promise((resolve, reject) => {
			const socketPath = `/tmp/electron-main-ipc-${process.pid.toString(16)}.sock`;
			this.ipc.listen({ path: socketPath }, (error) => {
				if (error != null) {
					reject(error);
				}

				resolve(socketPath);
			});
		});
	}

	beforeCompile() {
		this.state = false;
	}

	built(stats) {
		this.state = true;
		setImmediate(() => {
			if (!this.state) {
				return;
			}

			const hash = stats.toJson({ assets: false, chunks: false, children: false, modules: false }).hash;

			this.ipc.emit("/built", { hash });
		});
	}
}

module.exports = { HmrServer };
