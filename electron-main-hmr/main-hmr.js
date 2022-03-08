const socketPath = process.env.ELECTRON_HMR_SOCKET_PATH;
if (socketPath == null) throw new Error(`[HMR] Env ELECTRON_HMR_SOCKET_PATH is not set`);

const { HmrClient } = require("./HmrClient");

new HmrClient(socketPath, module.hot, () => {
	return __webpack_hash__;
});
