#!/usr/bin/env node

const { join } = require("path");
const yargs = require("yargs");

yargs
	.command(
		["*"],
		"Compile application",
		(yargs) => yargs,
		() => {
			process.env["NODE_ENV"] = "production";

			process.argv.push("--progress");
			process.argv.push("--config", join(__dirname, `webpack.app.config.js`));

			require("yargs")(process.argv.slice(2));
			require(require.resolve("webpack-cli"));
		}
	)
	.command(
		["dev"],
		"Run a development mode",
		(yargs) => yargs,
		() => require("./dev/dev-runner")
	).argv;
