import { spawn } from 'child_process'

export const spawnCommand = (command: string, commandArgs: string[], superuser = false) => {
    return new Promise<void>((resolve, reject) => {
        const commandProcess = spawn(superuser ? "sudo" : command, superuser ? [ command, ...commandArgs ] : commandArgs);

        commandProcess.stdout.on("data", (data: Buffer) => {
            console.log(data.toString())
        })
        commandProcess.stderr.on("data", (data: Buffer) => {
            console.log(data.toString())
        })

        commandProcess.on("close", (exitCode) => {
            if(exitCode > 0) return reject()
            return resolve()
        })
    })
}
