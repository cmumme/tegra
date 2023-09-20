import { dirname, resolve } from "path"
import { spawnCommand } from "./util/spawnCommand"
import { exec, execSync, spawn } from "child_process"
import { constants, readFile, writeFile } from "fs/promises"

// Constants
const UUID_REGEX = /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/gi

/**
 * A builder-style class used to generate an image with tegra.
 */
export class TegraBuilder {
    public targetDevice?: string
    public bootPartitionDevice?: string
    public swapPartitionDevice?: string
    public rootPartitionDevice?: string
    public partPrefix: string = ""
    public swapEnabled = false
    public swapSize = 0
    public quiet = false
    protected readonly buildFunctions: (() => Promise<void>)[] = [ ]
    protected readonly cleanupFunctions: (() => void)[] = [ ]
    private cleanupEnabled = true

    private async spawnChrootCommand(command: string) {
        return await this.spawnCommand("arch-chroot", [".tegra/rootfs", "bash", "-c", `${command}`], true)
    }

    private log(message: unknown, ...optionalParams: unknown[]) {
        if(this.quiet) return

        console.log(message, ...optionalParams)
    }

    private async spawnCommand(command: string, commandArgs: string[], superuser = false) {
        return await spawnCommand(command, commandArgs, superuser, this.quiet)
    }

    public delibrateFail() {
        this.buildFunctions.push(async () => {
            await this.spawnCommand("exit", ["1"])
        })

        return this
    }

    public noCleanup() {
        this.cleanupEnabled = false
        return this
    }

    public installGrub({ removable = false, bootloaderId = "TEGRA" }) {
        this.buildFunctions.push(async () => {
            this.log(`Installing GRUB${removable ? " in removable mode" : ""} with ID "${bootloaderId}"...`)

            await this.spawnChrootCommand(`grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id="${bootloaderId}" ${removable ? "--removable" : ""}`)
            await this.spawnChrootCommand("grub-mkconfig -o /boot/grub/grub.cfg")

            this.log("Installed GRUB!")
        })
    }

    /**
     * Installs refind with refind-install and configures the refind_linux.conf
     * 
     * @param options The options to use when installing refind
     * @returns this
     */
    public installRefind({ useDefault = false, allDrivers = false }) {
        this.buildFunctions.push(async () => {
            this.log("Installing rEFInd, do not be concerned if you get an ALERT.")
            await this.spawnChrootCommand(
                `refind-install --yes ${useDefault ? `--usedefault ${this.bootPartitionDevice}` : ""} ${allDrivers ? "--alldrivers" : ""}`
            ).catch(() => {
                this.log("Failed to execute refind-install in chroot")
            })

            const refindLinuxConfPath = ".tegra/rootfs/boot/refind_linux.conf"
            const lsblkOutput = await this.spawnChrootCommand(`blkid | grep ${this.rootPartitionDevice}`)
            const rootUUID = lsblkOutput.match(UUID_REGEX)[1] // Index 1 is PARTUUID
            const currentRefindLinuxConf = await readFile(
                refindLinuxConfPath, { encoding: "utf-8" }
            ).catch((err) => { })
            if(currentRefindLinuxConf) {
                const fixedRefindLinuxConf = currentRefindLinuxConf.replaceAll(UUID_REGEX, rootUUID)

                await writeFile(refindLinuxConfPath, fixedRefindLinuxConf, {
                    mode: constants.O_TRUNC
                }).catch((err) => {
                    this.log("Failed to write")
                    console.error(err)
                    process.exit(1)
                }) 
            } else {
                throw new Error(`Could not access ${currentRefindLinuxConf}. Ensure that there is a patch with some dummy options (including a UUID! (does not have to be correct)) for /boot/refind_linux.conf`)
            }
        
            this.log("Successfully installed rEFInd.")
        })

        return this
    }

    /**
     * Installs a list of packages to the new system via pacstrap with the -KMc options
     * 
     * @param packageList The list of packages to pacstrap
     * @returns this
     */
    public pacstrapPackages(packageList: string[]) {
        this.buildFunctions.push(async () => {
            this.log(`Pacstrapping ${packageList.length} packages...`)
            await this.spawnCommand("pacstrap", ["-KMc", ".tegra/rootfs", ...packageList], true)
            this.log(`Pacstrapped ${packageList.length} packages!`)
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
    public executeCommand(command: string) {
        this.buildFunctions.push(async () => {
            this.log(`Executing ${command} in chroot...`)
            await this.spawnChrootCommand(command)
            this.log(`Executed ${command} in chroot successfully!`)
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
            this.log(`Applying ${patchPath} to ${targetPath}...`)
            const patchPathResolved = resolve(patchPath)
            const targetPathResolved = resolve(`.tegra/rootfs/${targetPath}`)

            await this.spawnCommand("mkdir", ["-p", dirname(targetPathResolved)], true)

            await this.spawnCommand("patch", [targetPathResolved, patchPathResolved], true)
            this.log(`Applied ${patchPath} to ${targetPath}!`)
        })

        return this
    }

    public generateFSTab() {
        this.buildFunctions.push(async () => {
            this.log("Generating FSTab...")
            await this.spawnCommand("mkdir", ["-p", ".tegra/rootfs/etc"], true)
            execSync("sudo sh -c \"genfstab -U .tegra/rootfs >> .tegra/rootfs/etc/fstab\"")
            this.log("Generated and wrote FSTab!")
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
            this.log("Creating .tegra build fragment folder...")
            await this.spawnCommand("mkdir", ["-p", ".tegra/rootfs"])
            this.log("Created .tegra build fragment folder...")
        })

        return this
    }

    public mountPartitions() {
        this.buildFunctions.push(async () => {
            this.log("Mounting partitions...")
            await this.spawnCommand("mount", [this.rootPartitionDevice, ".tegra/rootfs"], true)
            if(this.swapEnabled) {
                await this.spawnCommand("swapon", [this.swapPartitionDevice])
            }
            await this.spawnCommand("mount", ["-m", this.bootPartitionDevice, ".tegra/rootfs/boot"], true)
            this.log("Mounted partitions!")
        })

        this.cleanupFunctions.push(() => {
            this.log("[CLEANUP] Unmounting partitions...")
            exec("sudo umount .tegra/rootfs/boot")
            exec("sudo umount .tegra/rootfs")
            exec("sudo umount -l .tegra/rootfs")
            if(!this.swapEnabled) return
            this.log("[CLEANUP] Turning off swap partition...")
    
            exec(`swapoff ${this.swapPartitionDevice}`)
        })

        return this
    }

    /**
     * Creates the GPT partition table on the target disk, partitions it with a boot and primary partition, and formats them
     * 
     * @returns this
     */
    public createPartitions(bootPartitionSize = 128) {
        if(!this.bootPartitionDevice)
            throw new Error(`No boot partition device has been assigned, ensure you have a useLoopbackDevice or useDisk build command.`)
        if(!this.rootPartitionDevice)
            throw new Error(`No boot partition device has been assigned, ensure you have a useLoopbackDevice or useDisk build command.`)

        this.buildFunctions.push(async () => {
            this.log("Partitioning and formatting...")
            await this.spawnCommand("parted", ["-s", this.targetDevice, "mktable", "GPT"], true)
            if(this.swapEnabled) {
                await this.spawnCommand("parted", [
                    "-s", "-a", "optimal", this.targetDevice, 
                    "mkpart", "Boot", "fat32", "0%", `${bootPartitionSize}`,
                    // Swap partition will be formatted with mkswap later
                    "mkpart", "Swap", "ext4", `${bootPartitionSize}`, `${bootPartitionSize+this.swapSize}`,
                    "mkpart", "Primary", "ext4", `${bootPartitionSize+this.swapSize}`, "100%"
                ], true)
            } else {
                await this.spawnCommand("parted", [
                    "-s", "-a", "optimal", this.targetDevice, 
                    "mkpart", "Boot", "fat32", "0%", `${bootPartitionSize}`,
                    "mkpart", "Primary", "ext4", `${bootPartitionSize}`, "100%"
                ], true)
            }
            await this.spawnCommand("mkfs.fat", ["-F", "32", this.bootPartitionDevice], true)
            if(this.swapEnabled) {
                await this.spawnCommand("mkswap", [this.swapPartitionDevice])
            }
            await this.spawnCommand("mkfs.ext4", [this.rootPartitionDevice], true)
            this.log("Partitioned and formatted successfully!")
        })

        return this
    }

    /**
     * Sets the target disk device to ``diskDevice`` and sets up the partition map
     * 
     * @param diskDevice The disk device to use (e.g /dev/sdb)
     * @returns this
     */
    public useDisk(diskDevice: string) {
        this.targetDevice = diskDevice
        this.bootPartitionDevice = `${this.targetDevice}${this.partPrefix}1`
        if(this.swapEnabled) {
            this.swapPartitionDevice = `${this.targetDevice}${this.partPrefix}2`
            this.rootPartitionDevice = `${this.targetDevice}${this.partPrefix}3`
        } else {
            this.rootPartitionDevice = `${this.targetDevice}${this.partPrefix}2`
        }

        return this
    }

    /**
     * Enables the swap partition with size ``swapSize``
     * 
     * @param swapSize The swap size to use (in MB)
     * @returns this
     */
    public enableSwap(swapSize = 2048) {
        if(this.targetDevice) throw new Error("Partition map already setup, use the enableSwap command before calling the useLoopbackDevice or useDisk build commands.")
        this.swapEnabled = true
        this.swapSize = swapSize

        return this
    }

    /**
     * Creates an image and a corresponding loopback device and assigns it as the target disk
     * 
     * @param imageSize The total size of the full image in GB
     * @returns this
     */
    public useImage(imageSize = 2) {
        this.targetDevice = "/dev/loop0"
        this.partPrefix = "p"
        this.bootPartitionDevice = `${this.targetDevice}${this.partPrefix}1`

        if(this.swapEnabled) {
            this.swapPartitionDevice = `${this.targetDevice}${this.partPrefix}2`
            this.rootPartitionDevice = `${this.targetDevice}${this.partPrefix}3`
        } else {
            this.rootPartitionDevice = `${this.targetDevice}${this.partPrefix}2`
        }

        this.buildFunctions.push(async () => {
            this.log("Setting up loopback device...")
            await this.spawnCommand("losetup", ["-D"], true)
            await this.spawnCommand("dd", ["if=/dev/zero", "of=.tegra/tegraBuild.img", "bs=100M", `count=${imageSize*10}`], true)
            await this.spawnCommand("losetup", ["-f", ".tegra/tegraBuild.img"], true)
            this.log("Set up the loopback device!")
        })

        this.cleanupFunctions.push(() => {
            this.log("[CLEANUP] Detaching the loopback device...")
            exec("sudo losetup -D")
        })

        return this
    }

    /**
     * Runs the build process, finalizes all configurations, and generates the final image
     */
    public async build() {
        if((await this.spawnCommand("whoami", [])).trim() !== "root") throw new Error("The builder must be run with superuser permissions. Retry as root, or using sudo")

        for(let i = 0; i < this.buildFunctions.length; i++) {
            await this.buildFunctions[i]()
        }
        this.log("Built and wrote to the target disk sucessfully!")
    }

    /**
     * Manually cleans up, unmounting partitions, disabling swap, etc
     */
    public cleanup() {
        for(let i = 0; i < this.cleanupFunctions.length; i++) {
            this.cleanupFunctions[i]()
        }
    }

    /**
     * Toggles output from this builder
     * 
     * @param quiet Whether or not the builder is quiet
     * @param sectioned Whether to make the entire build quiet, or just the commands up until quiet is disabled again (when)
     * @returns this
     */
    public setQuiet(quiet: boolean, sectioned = false) {
        if(!sectioned) this.quiet = quiet

        // We push to build functions to enable a build to be quiet in some sections and not quiet in others
        this.buildFunctions.push(async () => {
            this.quiet = quiet
        })

        return this
    }

    public constructor() {
        process.on("exit", async (ExitCode) => {
            if(!this.cleanupEnabled) return

            this.cleanup()

            process.exit(ExitCode)
        })
    }
}

process.on("SIGINT", () => {
    process.exit(1)
})

process.on("uncaughtException", (err) => {
    console.error(err)
    process.exit(1)
})
