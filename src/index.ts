import winston = require('winston');
import { startSandbox, SandboxResult, MountInfo } from 'simple-sandbox/lib/index';
import { globalConfig } from './config';
import { moveFromWorkingDirectory, moveToWorkingDirectory } from './utils';
import sleep = require('sleep-promise');
import fs = require('fs-extra');
import Queue = require("promise-queue");
import { SandboxProcess } from 'simple-sandbox/lib/sandboxProcess';

const io = require('socket.io')();
const availableWorkingDirectories = globalConfig.taskWorkingDirectories;
const queue = new Queue(Math.min(globalConfig.maxConcurrent, availableWorkingDirectories.length));

io.on('connection', (socket: any) => {
    winston.info('Connected');
    socket.on("startSandbox", async (data: any, callback: any) => {
        winston.info('Receive startSandbox request [' + data.uuid + '], waiting for an available working directory');
        winston.debug(data.args);
        queue.add(async () => {
            const taskWorkingDirectory = availableWorkingDirectories.pop();
            winston.info('Get working directory [' + taskWorkingDirectory + '] for request [' + data.uuid + ']');

            const mounts: MountInfo[] = data.args.mounts;
            let realMounts: MountInfo[];
            let sandboxedProcess: SandboxProcess;

            try {
                realMounts = await moveToWorkingDirectory(mounts, taskWorkingDirectory);
                data.args.mounts = realMounts;
                sandboxedProcess = await startSandbox(data.args);
            } catch (e) {
                winston.info('Sandbox [' + data.uuid + '] start failed, reason: ' + e.message);
                callback({ success: false, reason: e.message }, null, null);
                availableWorkingDirectories.push(taskWorkingDirectory);
                return;
            }

            winston.info('Sandbox [' + data.uuid + '] started, PID: ' + sandboxedProcess.pid);
            await fs.promises.mkdir('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup, { recursive: true });
            callback({ success: true }, sandboxedProcess.pid, sandboxedProcess.parameter.cgroup);

            await sandboxedProcess.waitForStop().then(async (result: SandboxResult) => {
                await moveFromWorkingDirectory(mounts, realMounts);
                winston.info('Sandbox [' + data.uuid + '] ended');
                socket.emit("sandboxEnded", data.uuid, result, async () => {
                    // winston.info('Sandbox [' + data.uuid + '] ended infomation has benn received');
                    await fs.promises.rmdir('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup, { recursive: true });
                });
            });

            availableWorkingDirectories.push(taskWorkingDirectory);
        });
    });
});

io.listen(globalConfig.port);
