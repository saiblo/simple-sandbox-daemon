import { startSandbox, SandboxResult, MountInfo, SandboxStatus } from 'simple-sandbox/lib/index';
import { moveFromWorkingDirectory, moveToWorkingDirectory, ensureDirectories, setDirectoriesPermission, openAllFIFO } from './utils';
import { SandboxProcess } from 'simple-sandbox/lib/sandboxProcess';
import { timeout, TimeoutError } from 'promise-timeout';

const winston = {
    debug: message => process.send({ type: "debug", data: message }),
    info: message => process.send({ type: "info", data: message }),
    error: message => process.send({ type: "error", data: message })
}

let sandboxedProcess: SandboxProcess | null = null;
const data = JSON.parse(process.argv[2]);
const taskWorkingDirectory: string | null = process.argv[3] === "null" ? null : process.argv[3];

const task = async () => {
    if (taskWorkingDirectory === null) {
        winston.debug('No working directory needed for request [' + data.uuid + ']');
    } else {
        winston.debug('Get working directory [' + taskWorkingDirectory + '] for request [' + data.uuid + ']');
    }

    const mounts: MountInfo[] = data.args.mounts;
    let realMounts: MountInfo[];

    try {
        await ensureDirectories(data.args);
        if (taskWorkingDirectory !== null) {
            realMounts = await moveToWorkingDirectory(mounts, taskWorkingDirectory);
            data.args.mounts = realMounts;
        }
        await setDirectoriesPermission(data.args.mounts);
        winston.debug(JSON.stringify(data.args));

        try {
            [data.args.stdin, data.args.stdout, data.args.stderr] = await timeout(openAllFIFO(data.args), 3000)
        } catch (err) {
            if (err instanceof TimeoutError)
                throw new Error("Open FIFO timeout.");
            else throw err;
        }

        sandboxedProcess = startSandbox(data.args);
        winston.info('Sandbox [' + data.uuid + '] started');
    } catch (e) {
        winston.error('Sandbox [' + data.uuid + '] start failed, reason: ' + e.message);
        process.send({
            type: "start",
            data: [{ success: false, reason: e.message }, null, null]
        });
        process.disconnect();
        return;
    }

    process.send({
        type: "start",
        data: [{ success: true }, sandboxedProcess.pid, sandboxedProcess.parameter.cgroup]
    });

    await sandboxedProcess.waitForStop().then(async (result: SandboxResult) => {
        if (taskWorkingDirectory !== null) {
            await moveFromWorkingDirectory(mounts, realMounts);
        }
        winston.info('Sandbox [' + data.uuid + '] ended');
        process.send({
            type: "end",
            data: [data.uuid, result]
        })
    }).catch(e => {
        winston.error('Sandbox [' + data.uuid + '] run failed, reason: ' + e.message);
        const errResult: SandboxResult = {
            status: SandboxStatus.RuntimeError,
            time: -1,
            memory: -1,
            code: -1
        };
        process.send({
            type: "end",
            data: [data.uuid, errResult]
        })
    });
    process.disconnect();
}

process.on('disconnect', () => {
    winston.info('Killing sandbox [' + data.cgroup + '].');
    if (sandboxedProcess && sandboxedProcess.running) {
        winston.info('Killing sandbox [' + data.cgroup + '].');
    }
    process.exit()
});

process.on('exit', () => {
    winston.info('Killing sandbox [' + data.cgroup + '].');
    if (sandboxedProcess && sandboxedProcess.running) {
        winston.info('Killing sandbox [' + data.cgroup + '].');
    }
});

const terminationHandler = () => {
};

process.on('SIGTERM', terminationHandler);
process.on('SIGINT', terminationHandler);

task();
