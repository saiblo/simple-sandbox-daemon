import { startSandbox, SandboxResult, MountInfo } from '/opt/simple-sandbox/lib/index';
import { moveFromWorkingDirectory, moveToWorkingDirectory, ensureDirectories, setDirectoriesPermission } from './utils';
import { SandboxProcess } from '/opt/simple-sandbox/lib/sandboxProcess';

const winston = {
    debug: message => process.send({ type: "debug", data: message }),
    info: message => process.send({ type: "info", data: message }),
    error: message => process.send({ type: "error", data: message })
}

const task = async () => {
    const data = JSON.parse(process.argv[2])
    const taskWorkingDirectory: string | null = process.argv[3]

    if (taskWorkingDirectory === null) {
        winston.debug('No working directory needed for request [' + data.uuid + ']');
    } else {
        winston.debug('Get working directory [' + taskWorkingDirectory + '] for request [' + data.uuid + ']');
    }

    const mounts: MountInfo[] = data.args.mounts;
    let realMounts: MountInfo[];
    let sandboxedProcess: SandboxProcess;

    try {
        await ensureDirectories(data.args);
        if (taskWorkingDirectory !== null) {
            realMounts = await moveToWorkingDirectory(mounts, taskWorkingDirectory);
            data.args.mounts = realMounts;
        }
        await setDirectoriesPermission(data.args.mounts);
        winston.debug(JSON.stringify(data.args));
        sandboxedProcess = startSandbox(data.args);
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
    }).catch(err => {
        winston.error(err);
        // process.send({
        // type: "end",
        // data: [data.uuid, result]
        // })
    });
    process.disconnect();
}

process.on('disconnect', () => process.exit());

task()