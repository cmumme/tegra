import { constants, readFile, writeFile } from "fs/promises"
import type { TegraBuilder } from ".."

const UUID_REGEX = /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/gi

/**
 * Installs refind with refind-install and configures the refind_linux.conf
 * 
 * @param options The options to use when installing refind
 */
export function installRefind({ useDefault = false, allDrivers = false }) {
    return function(self: TegraBuilder) {
        self.buildFunctions.push(async () => {
            self.log("Installing rEFInd, do not be concerned if you get an ALERT.")
            await self.spawnChrootCommand(
                `refind-install --yes ${useDefault ? `--usedefault ${self.bootPartitionDevice}` : ""} ${allDrivers ? "--alldrivers" : ""}`
            ).catch(() => {
                self.log("Failed to execute refind-install in chroot")
            })

            const refindLinuxConfPath = ".tegra/rootfs/boot/refind_linux.conf"
            const lsblkOutput = await self.spawnChrootCommand(`blkid | grep ${self.rootPartitionDevice}`)
            const rootUUID = lsblkOutput.match(UUID_REGEX)[1] // Index 1 is PARTUUID
            const currentRefindLinuxConf = await readFile(
                refindLinuxConfPath, { encoding: "utf-8" }
            ).catch((err) => { })
            if(currentRefindLinuxConf) {
                const fixedRefindLinuxConf = currentRefindLinuxConf.replaceAll(UUID_REGEX, rootUUID)

                await writeFile(refindLinuxConfPath, fixedRefindLinuxConf, {
                    mode: constants.O_TRUNC
                }).catch((err) => {
                    self.log("Failed to write")
                    console.error(err)
                    process.exit(1)
                }) 
            } else {
                throw new Error(`Could not access ${currentRefindLinuxConf}. Ensure that there is a patch with some dummy options (including a UUID! (does not have to be correct)) for /boot/refind_linux.conf`)
            }
        
            self.log("Successfully installed rEFInd.")
        })
    }
}