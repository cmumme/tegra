import { spawn } from 'child_process'

export const spawnCommand = (command: string, commandArgs: string[], superuser = false) => {
    return new Promise<string>((resolve, reject) => {
        const commandProcess = spawn(superuser ? "sudo" : command, superuser ? [ command, ...commandArgs ] : commandArgs);
        let totalData = ""

        commandProcess.stdout.on("data", (data: Buffer) => {
            totalData += data.toString()
            console.log(data.toString())
        })
        commandProcess.stderr.on("data", (data: Buffer) => {
            totalData += data.toString()
            console.log(data.toString())
        })

        commandProcess.on("close", (exitCode) => {
            if(exitCode > 0) return reject(totalData)
            return resolve(totalData)
        })
    })
}
