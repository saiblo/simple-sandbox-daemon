import winston = require('winston');
import { startSandbox, SandboxResult, MountInfo } from '/opt/simple-sandbox/lib/index';
import { SandboxProcess } from '/opt/simple-sandbox/lib/sandboxProcess';

(async () => {
    const promiseList: Promise<SandboxProcess>[] = [];
    const args = {
        hostname: "qwq",
        chroot: "/opt/sandbox/rootfs",
        mounts: [
            {
                src: "/opt/sandbox-test/binary",
                dst: "/sandbox/binary",
                limit: 0
            }, {
                src: "/opt/sandbox-test/working",
                dst: "/sandbox/working",
                limit: 0
            }, {
                src: "/opt/sandbox-test/tmp",
                dst: "/tmp",
                limit: 0
            }
        ],
        executable: "/usr/bin/python3",
        parameters: ["/usr/bin/python3", "ai.py"],
        environments: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
        stdin: "/dev/null",
        stdout: "/dev/null",
        stderr: "/dev/null",
        time: 1000, // 1 minute, for a bash playground
        mountProc: true,
        redirectBeforeChroot: true,
        memory: 10 * 1024 * 1024, // 10MB
        process: 10,
        user: "nobody",
        cgroup: "test",
        workingDirectory: "/sandbox/working"
    }
    for (let i = 0; i < 3; ++i) {
        // promiseList.push(startSandbox(args))
    }
    winston.info("PUSHED")
    await Promise.all(promiseList);
    winston.info("END")
})();
