import winston = require('winston');
import { globalConfig } from './config';
import Queue = require("promise-queue");
import fs = require("fs-extra");
import { task } from './task';

const io = require('socket.io')();
const availableWorkingDirectories = globalConfig.taskWorkingDirectories;
const queue = new Queue(Math.min(globalConfig.maxConcurrent, availableWorkingDirectories.length));

io.on('connection', (socket: any) => {
    winston.info('Connected');
    socket.on("startSandbox", async (data: any, callback: any) => {
        winston.info('Receive startSandbox request [' + data.uuid + ']');

        let needWorkingDir: boolean = false;

        for (const mountInfo of data.args.mounts)
            if (mountInfo.limit !== 0) {
                needWorkingDir = true;
            }

        if (needWorkingDir) {
            queue.add(async () => {
	        // winston.debug(availableWorkingDirectories);
                const taskWorkingDirectory = availableWorkingDirectories.pop();
                try {
                    await task(data, taskWorkingDirectory, socket, callback);
                } catch (e) {
                    winston.error(e.message);
                }
                availableWorkingDirectories.push(taskWorkingDirectory);
            });
        } else {
            queue.add(async () => {
                try {
                    await task(data, null, socket, callback);
                } catch (e) {
                    winston.error(e.message);
                }
            });
        }
    });
});

io.listen(globalConfig.port);
