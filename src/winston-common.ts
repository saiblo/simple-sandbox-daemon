import winston = require('winston');

export function configureWinston(verbose: boolean) {
    // winston.configure({
    // transports: [
    // new (winston.transports.Console)()
    // ]
    // });
    winston.add(
        new winston.transports.Console({
            level: verbose ? "debug" : "info",
            format: winston.format.combine(winston.format.cli())
        })
    );
    if (verbose) {
        (winston as any).level = 'debug';
    } else {
        (winston as any).level = 'info';
    }
}