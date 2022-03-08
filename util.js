const BluebirdPromise = require("bluebird");
const { stat } = require("fs-extra");
const { join } = require("path");

async function statOrNull(file) {
	return orNullIfFileNotExist(stat(file));
}

function orNullIfFileNotExist(promise) {
	return promise.catch((e) => {
		if (e.code === "ENOENT" || e.code === "ENOTDIR") {
			return null;
		}
		throw e;
	});
}

function getFirstExistingFile(names, rootDir = null) {
	return BluebirdPromise.filter(
		names.map((it) => (rootDir == null ? it : join(rootDir, it))),
		(it) => statOrNull(it).then((it) => it != null)
	).then((it) => (it.length > 0 ? it[0] : null));
}

module.exports = {
	statOrNull,
	orNullIfFileNotExist,
	getFirstExistingFile,
};
