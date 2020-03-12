import winston = require('winston');
import { fork } from 'child_process';

export async function task(data: any, taskWorkingDirectory: string | null, socket: any, callback: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = fork('lib/sandbox', [JSON.stringify(data), taskWorkingDirectory])
        child.on('message', message => {
            const msg = JSON.parse(JSON.stringify(message))
            if (msg.type === "start") {
                callback(...msg.data);
            } else if (msg.type === "end") {
                socket.emit("sandboxEnded", ...msg.data);
                resolve();
            } else if (msg.type === "info") {
                winston.info(msg.data);
            } else if (msg.type === "debug") {
                winston.debug(msg.data);
            } else if (msg.type === "error") {
                winston.error(msg.data);
            }
        });
    });
};
