import winston = require('winston');
import { startSandbox, SandboxResult, MountInfo } from '/opt/simple-sandbox/lib/index';
import { globalConfig } from './config';
import { moveFromWorkingDirectory, moveToWorkingDirectory, ensureDirectories, setDirectoriesPermission } from './utils';
import sleep = require('sleep-promise');
import fs = require('fs-extra');
import Queue = require("promise-queue");
import { SandboxProcess } from '/opt/simple-sandbox/lib/sandboxProcess';

const io = require('socket.io')();
const availableWorkingDirectories = globalConfig.taskWorkingDirectories;
const queue = new Queue(Math.min(globalConfig.maxConcurrent, availableWorkingDirectories.length));

io.on('connection', (socket: any) => {
    winston.info('Connected');
    socket.on("startSandbox", async (data: any, callback: any) => {
        winston.info('Receive startSandbox request [' + data.uuid + ']');

        const task = async (taskWorkingDirectory: string | null) => {
            if (taskWorkingDirectory === null) {
                winston.info('No working directory needed for request [' + data.uuid + ']');
            } else {
                winston.info('Get working directory [' + taskWorkingDirectory + '] for request [' + data.uuid + ']');
            }

            const mounts: MountInfo[] = data.args.mounts;
            let realMounts: MountInfo[];
            let sandboxedProcess: SandboxProcess;

            // try {
            await ensureDirectories(data.args);
            if (taskWorkingDirectory !== null) {
                realMounts = await moveToWorkingDirectory(mounts, taskWorkingDirectory);
                data.args.mounts = realMounts;
            }
            await setDirectoriesPermission(data.args.mounts);
            winston.debug(JSON.stringify(data.args));
            sandboxedProcess = startSandbox(data.args);
            // } catch (e) {
            //     winston.error('Sandbox [' + data.uuid + '] start failed, reason: ' + e.message);
            //     callback({ success: false, reason: e.message }, null, null);
            //     return;
            // }

            winston.info('Sandbox [' + data.uuid + '] started, PID: ' + sandboxedProcess.pid);
            callback({ success: true }, sandboxedProcess.pid, sandboxedProcess.parameter.cgroup);

            await sandboxedProcess.waitForStop().then(async (result: SandboxResult) => {
                if (taskWorkingDirectory !== null) {
                    await moveFromWorkingDirectory(mounts, realMounts);
                }
                winston.info('Sandbox [' + data.uuid + '] ended');
                socket.emit("sandboxEnded", data.uuid, result, async () => {
                    // winston.info('Sandbox [' + data.uuid + '] ended infomation has benn received');
                });
            });
        };

        let needWorkingDir: boolean = false;

        for (const mountInfo of data.args.mounts)
            if (mountInfo.limit !== 0) {
                needWorkingDir = true;
            }

        if (needWorkingDir) {
            queue.add(async () => {
                winston.debug(availableWorkingDirectories);
                const taskWorkingDirectory = availableWorkingDirectories.pop();
                try {
                    await task(taskWorkingDirectory);
                } catch (e) {
                    winston.error(e.message);
                }
                availableWorkingDirectories.push(taskWorkingDirectory);
            });
        } else {
            // try {
            await task(null);
            // } catch (e) {
            // winston.error(e.message);
            // }
        }
    });
});

io.listen(globalConfig.port);
