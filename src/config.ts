
import commandLineArgs = require('command-line-args');
import fs = require('fs');
import winston = require('winston');
import { configureWinston } from './winston-common';
import { plainToClass, Type } from "class-transformer";

export class Config {
    hostname: string;
    port: number;
    sandboxUser: string;
    sandboxRoot: string;
    maxConcurrent: number;
    taskWorkingDirectories: string[];
}

const optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'config', alias: 'c', type: String },
];

const options = commandLineArgs(optionDefinitions);

const parsedConfig = JSON.parse(fs.readFileSync(options['config']).toString("utf-8"));
export const globalConfig = plainToClass(Config, parsedConfig);

configureWinston(options.verbose);