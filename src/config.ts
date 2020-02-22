
import commandLineArgs = require('command-line-args');
import fs = require('fs');
import winston = require('winston');
import { configureWinston } from './winston-common';

export interface ConfigStructure {
    hostname: string,
    port: number,
    sandboxUser: string,
    sandboxRoot: string
    user: string,
}

const optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'config', alias: 'c', type: String },
];

const options = commandLineArgs(optionDefinitions);

function readJSON(path: string): any {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const configJSON = readJSON(options['config']);
export const globalConfig: ConfigStructure = {
    hostname: configJSON.hostname,
    port: configJSON.port,
    user: configJSON.user,
    sandboxUser: configJSON.sandboxUser,
    sandboxRoot: configJSON.sandboxRoot
}

configureWinston(options.verbose);