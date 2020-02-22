import winston = require('winston');
import util = require('util');
import { startSandbox, SandboxResult } from 'simple-sandbox/lib/index';
import { globalConfig } from './config';
import sleep = require('sleep-promise');
import fs = require('fs-extra');
import posix = require('posix');

const io = require('socket.io')();

io.on('connection', (socket: any) => {
    winston.info('Connected');
    socket.on("startSandbox", async (data: any, callback: any) => {
        winston.info('Receive startSandbox request [' + data.uuid + ']');
        winston.debug(data.args);

        const sandboxedProcess = await startSandbox(data.args);

        // await fs.chown('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup + '/tasks', user.uid, user.gid);
        // await fs.chown('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup + '/freezer.state', user.uid, user.gid);
        // await fs.chmod('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup, 0o777);

        winston.info('Sandbox [' + data.uuid + '] started, PID: ' + sandboxedProcess.pid);

        await fs.promises.mkdir('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup, { recursive: true });
        callback(sandboxedProcess.pid, sandboxedProcess.parameter.cgroup);

        sandboxedProcess.waitForStop().then(async (result: SandboxResult) => {
            winston.info('Sandbox [' + data.uuid + '] ended');
            socket.emit("sandboxEnded", data.uuid, result, async () => {
                // winston.info('Sandbox [' + data.uuid + '] ended infomation has benn received');
                await fs.promises.rmdir('/sys/fs/cgroup/freezer/' + sandboxedProcess.parameter.cgroup, { recursive: true });
            });
        });
    });
});

io.listen(globalConfig.port);
