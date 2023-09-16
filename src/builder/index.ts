import { dirname, resolve } from "path"
import { spawnCommand } from "../util/spawnCommand"

/**
 * A builder-style class used to generate an image with tegra.
 */
export class TegraBuilder {
    protected readonly buildFunctions: (() => Promise<void>)[] = [ ]
    protected readonly cleanupFunctions: (() => Promise<void>)[] = [ ]
    private beforeExitCalled = false

    public delibrateFail() {
        this.buildFunctions.push(async () => {
            await spawnCommand("exit", ["1"])
        })

        return this
    }

    /**
     * Installs a list of packages to the new system via pacstrap with the -KM options
     * 
     * @param packageList The list of packages to pacstrap
     * @returns this
     */
    public pacstrapPackages(packageList: string[]) {
        this.buildFunctions.push(async () => {
            await spawnCommand("pacstrap", ["-KM", ".tegra/rootfs", ...packageList], true)
        })

        return this
    }

    /**
     * Executes a command on the new system via arch-chroot
     * 
     * @param command The base command (e.g cat) to execute on the new system
     * @param commandArgs The arguments to provide to the command
     * @returns this
     */
    public executeCommand(command: string, commandArgs: string[]) {
        this.buildFunctions.push(async () => {
            await spawnCommand("arch-chroot", [".tegra/rootfs", `${command} ${commandArgs.join(" ")}`], true)
        })

        return this
    }

    /**
     * Applies a patch to a file (or creates a new file if needed) on the new system
     * 
     * @param patchPath The path to the .patch or .diff file
     * @param targetPath The path to the file to apply the patch to, relative to the new system's root
     * @returns this
     */
    public applyPatch(patchPath: string, targetPath: string) {
        this.buildFunctions.push(async () => {
            const patchPathResolved = resolve(patchPath)
            const targetPathResolved = resolve(`.tegra/rootfs/${targetPath}`)

            await spawnCommand("mkdir", ["-p", dirname(targetPathResolved)], true)

            await spawnCommand("patch", [targetPathResolved, patchPathResolved], true)
        })

        return this
    }

    /**
     * Sets up the .tegra folder (where build fragments are stored)
     * 
     * @returns this
     */
    public createTegraFiles() {
        this.buildFunctions.push(async () => {
            await spawnCommand("mkdir", ["-p", ".tegra/rootfs"])
        })

        return this
    }

    /**
     * Creates the loopback device/image that we create and configure the new system on
     * 
     * @returns this
     */
    public createLoopbackDevice() {
        this.buildFunctions.push(async () => {
            await spawnCommand("dd", ["if=/dev/zero", "of=.tegra/tegraLoopback.img", "bs=100M", "count=10"], true)
            await spawnCommand("losetup", ["-fP", ".tegra/tegraLoopback.img"], true)
            await spawnCommand("mkfs.ext4", [".tegra/tegraLoopback.img"], true)
            await spawnCommand("mount", ["--mkdir", "-o", "loop", "/dev/loop0", ".tegra/rootfs"], true)
        })

        this.cleanupFunctions.push(async () => {
            await spawnCommand("umount", [".tegra/rootfs"], true)
            await spawnCommand("losetup", ["-D"], true)
        })

        return this
    }

    /**
     * Runs the build process, finalizes all configurations, and generates the final image
     */
    public async build() {
        for(let i = 0; i < this.buildFunctions.length; i++) {
            await this.buildFunctions[i]()
        }
    }
}
