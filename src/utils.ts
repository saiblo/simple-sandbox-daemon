import posix = require("posix");
import fs = require("fs-extra");
import path = require("path");
import klaw = require("klaw");
import md5 = require('md5');
import winston = require('winston');
import deepcopy = require('deepcopy');
import { MountInfo, SandboxParameter } from '/opt/simple-sandbox/lib/index';

import { globalConfig } from "./config";

export async function setDirectoryPermission(dirName: string, writeAccess: boolean): Promise<void> {
    const user = posix.getpwnam(globalConfig.sandboxUser);
    const operations: Promise<void>[] = [];
    return await new Promise((res, rej) => {
        klaw(dirName)
            .on("data", item => {
                operations.push(
                    (async () => {
                        const path = item.path;
                        await fs.chmod(path, 0o755);
                        if (writeAccess) {
                            await fs.chown(path, user.uid, user.gid);
                        } else {
                            await fs.chown(path, process.getuid(), process.getgid());
                        }
                    })()
                );
            })
            .on("end", () => {
                Promise.all(operations).then(() => res(), rej);
            });
    });
}

export async function ensureDirectoryEmpty(path: string): Promise<void> {
    await fs.ensureDir(path);
    await fs.emptyDir(path);
}

export async function moveToWorkingDirectory<T>(mounts: MountInfo[], taskWorkingDirectory: string): Promise<MountInfo[]> {
    const realMounts = deepcopy(mounts);

    await ensureDirectoryEmpty(taskWorkingDirectory);

    for (let i = 0; i < mounts.length; ++i)
        if (mounts[i].limit !== 0) {
            realMounts[i].src = taskWorkingDirectory + md5(mounts[i].src) + '/';
            winston.debug(`Cleaning [${realMounts[i].src}]`)
            await ensureDirectoryEmpty(realMounts[i].src);
            winston.debug(`Copy from [${mounts[i].src}] to [${realMounts[i].src}]`)
            await fs.copy(mounts[i].src, realMounts[i].src);
            await setDirectoryPermission(realMounts[i].src, true);
        } else {
            await setDirectoryPermission(realMounts[i].src, false);
        }

    return realMounts;
}

export async function moveFromWorkingDirectory<T>(mounts: MountInfo[], realMounts: MountInfo[]): Promise<void> {
    for (let i = 0; i < mounts.length; ++i)
        if (mounts[i].limit !== 0) {
            winston.debug(`Cleaning [${mounts[i].src}]`)
            await ensureDirectoryEmpty(mounts[i].src);
            winston.debug(`Copy from [${realMounts[i].src}] to [${mounts[i].src}]`)
            await fs.copy(realMounts[i].src, mounts[i].src);
        }
}

export async function ensureDirectories<T>(args: SandboxParameter): Promise<void> {
    await Promise.all(args.mounts.map((mountInfo =>
        Promise.all([
            fs.ensureDir(mountInfo.src),
            fs.ensureDir(path.join(args.chroot, mountInfo.dst))
        ]))));
}

export async function setDirectoriesPermission<T>(mounts: MountInfo[]): Promise<void> {
    await Promise.all(mounts.map((mountInfo => setDirectoryPermission(mountInfo.src, mountInfo.limit !== 0))));
}