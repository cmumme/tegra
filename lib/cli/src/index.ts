#! /usr/bin/env node

import { program } from "commander"

program
    .name("tegra-cli")
    .description("CLI for interacting with the Tegra profiler")
    .version(require("../package.json").version)

import "./commands/parse"

program.parse()