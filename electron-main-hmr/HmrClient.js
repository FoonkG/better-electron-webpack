const Crocket = require("crocket");

class HmrClient {
	constructor(socketPath, hot, currentHashGetter) {
		this.hot = hot;
		this.currentHashGetter = currentHashGetter;
		this.lastHash = null;
		this.ipc = new Crocket();

		if (hot == null) throw new Error(`[HMR] Hot Module Replacement is disabled.`);

		this.ipc.connect({ path: socketPath }, (error) => {
			if (error != null) {
				console.error(error.stack || error.toString());
			}
		});

		this.ipc.on("error", (error) => {
			console.error(error.stack || error.toString());
		});

		this.ipc.on("/built", (data) => {
			this.lastHash = data.hash;
			if (this.isUpToDate()) {
				return;
			}

			const status = hot.status();
			if (status === "idle") {
				this.check();
			} else if (status === "abort" || status === "fail") {
				console.warn(`[HMR] Cannot apply update as a previous update ${status}ed. Need to do a full reload!`);
			}
		});
	}

	isUpToDate() {
		return this.lastHash === this.currentHashGetter();
	}

	check() {
		this.hot
			.check(true)
			.then((outdatedModules) => {
				if (outdatedModules == null) {
					console.warn(`[HMR] Cannot find update. Need to do a full reload!`);
					return;
				}

				require("webpack/hot/log-apply-result")(outdatedModules, outdatedModules);

				if (this.isUpToDate()) {
					console.log(`[HMR] App is up to date.`);
				}
			})
			.catch((error) => {
				const status = this.hot.status();
				if (status === "abort" || status === "fail") {
					console.warn(`[HMR] ${error.stack || error.toString()}`);
					console.warn("[HMR] Cannot apply update. Need to do a full reload - application will be restarted");
					require("electron").app.exit(100);
				} else {
					console.warn(`[HMR] Update failed: ${error.stack || error.message}`);
				}
			});
	}
}

module.exports = { HmrClient };
