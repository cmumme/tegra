import chalk from "chalk";

export namespace log {
    export function info(message: string) {
        console.log(`${chalk.blue("info")} ${message}`)
    }
    export function warn(message: string) {
        console.warn(`${chalk.yellow("warn")} ${message}`)
    }
    export function success(message: string) {
        console.log(`${chalk.green("success")} ${message}`)
    }
    export function err(message: string) {
        console.error(`${chalk.red("error")} ${message}`)
    }
}