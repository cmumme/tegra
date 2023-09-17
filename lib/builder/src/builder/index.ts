import { dirname, resolve } from "path"
import { spawnCommand } from "../util/spawnCommand"
import { exec, execSync } from "child_process"
import { constants, readFile, writeFile } from "fs/promises"

// Constants
const UUID_REGEX = /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/gi

/**
 * A builder-style class used to generate an image with tegra.
 */
export class TegraBuilder {
    protected readonly buildFunctions: (() => Promise<void>)[] = [ ]
    protected readonly cleanupFunctions: (() => void)[] = [ ]
    private cleanupEnabled = true

    private async spawnChrootCommand(command: string) {
        return await spawnCommand("arch-chroot", [".tegra/rootfs", "bash", "-c", `${command}`], true)
    }

    public delibrateFail() {
        this.buildFunctions.push(async () => {
            await spawnCommand("exit", ["1"])
        })

        return this
    }

    public noCleanup() {
        this.cleanupEnabled = false
        return this
    }

    public installGrub({ removable = false, bootloaderId = "TEGRA" }) {
        this.buildFunctions.push(async () => {
            console.log(`Installing GRUB${removable ? " in removable mode" : ""} with ID "${bootloaderId}"...`)

            await this.spawnChrootCommand(`grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id="${bootloaderId}" ${removable ? "--removable" : ""}`)
            await this.spawnChrootCommand("grub-mkconfig -o /boot/grub/grub.cfg")

            console.log("Installed GRUB!")
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
            console.log("Installing rEFInd, do not be concerned if you get an ALERT.")
            await this.spawnChrootCommand(
                `refind-install --yes ${useDefault ? "--usedefault /dev/loop0p1" : ""} ${allDrivers ? "--alldrivers" : ""}`
            ).catch(() => {
                console.log("Failed to execute refind-install in chroot")
            })

            const refindLinuxConfPath = ".tegra/rootfs/boot/refind_linux.conf"
            const lsblkOutput = await this.spawnChrootCommand("blkid | grep /dev/loop0p2")
            const rootUUID = lsblkOutput.match(UUID_REGEX)[1] // Index 1 is PARTUUID
            const currentRefindLinuxConf = await readFile(
                refindLinuxConfPath, { encoding: "utf-8" }
            ).catch((err) => { })
            if(currentRefindLinuxConf) {
                // Not sure what to do here.
                const fixedRefindLinuxConf = currentRefindLinuxConf.replaceAll(UUID_REGEX, rootUUID)

                await writeFile(refindLinuxConfPath, fixedRefindLinuxConf, {
                    mode: constants.O_TRUNC
                }).catch((err) => {
                    console.log("Failed to write")
                    console.error(err)
                    process.exit(1)
                }) 
            }
        
            console.log("Successfully installed rEFInd.")
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
            console.log(`Pacstrapping ${packageList.length} packages...`)
            await spawnCommand("pacstrap", ["-KM", ".tegra/rootfs", ...packageList], true)
            console.log(`Pacstrapped ${packageList.length} packages!`)
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
            console.log(`Executing ${command} in chroot...`)
            await this.spawnChrootCommand(command)
            console.log(`Executed ${command} in chroot successfully!`)
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
            console.log(`Applying ${patchPath} to ${targetPath}...`)
            const patchPathResolved = resolve(patchPath)
            const targetPathResolved = resolve(`.tegra/rootfs/${targetPath}`)

            await spawnCommand("mkdir", ["-p", dirname(targetPathResolved)], true)

            await spawnCommand("patch", [targetPathResolved, patchPathResolved], true)
            console.log(`Applied ${patchPath} to ${targetPath}!`)
        })

        return this
    }

    public generateFSTab() {
        this.buildFunctions.push(async () => {
            console.log("Generating FSTab...")
            await spawnCommand("mkdir", ["-p", ".tegra/rootfs/etc"], true)
            execSync("sudo sh -c \"genfstab -U .tegra/rootfs >> .tegra/rootfs/etc/fstab\"")
            console.log("Generated and wrote FSTab!")
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

    public mountPartitions() {
        this.buildFunctions.push(async () => {
            console.log("Mounting partitions...")
            await spawnCommand("mount", ["/dev/loop0p2", ".tegra/rootfs"], true)
            await spawnCommand("mount", ["-m", "/dev/loop0p1", ".tegra/rootfs/boot"], true)
            console.log("Mounted partitions!")
        })

        this.cleanupFunctions.push(() => {
            console.log("[CLEANUP] Unmounting partitions...")
            exec("sudo umount .tegra/rootfs/boot")
            exec("sudo umount .tegra/rootfs")
            exec("sudo umount -l .tegra/rootfs")
        })

        return this
    }

    /**
     * Creates the GPT partition table on the loopback device, partitions it with a boot and primary partition, and formats them
     * 
     * @returns this
     */
    public createPartitions(bootPartitionSizeMB = 128) {
        this.buildFunctions.push(async () => {
            console.log("Partitioning and formatting...")
            await spawnCommand("parted", ["-s", "/dev/loop0", "mktable", "GPT"], true)
            await spawnCommand("parted", [
                "-s", "-a", "optimal", "/dev/loop0", 
                "mkpart", "Boot", "fat32", "0%", `${bootPartitionSizeMB}`,
                "mkpart", "Primary", "ext4", `${bootPartitionSizeMB}`, "100%"
            ], true)
            await spawnCommand("mkfs.fat", ["-F", "32", "/dev/loop0p1"], true)
            await spawnCommand("mkfs.ext4", ["/dev/loop0p2"], true)
            console.log("Partitioned and formatted successfully!")
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
            console.log("Setting up loopback device...")
            await spawnCommand("losetup", ["-D"], true)
            await spawnCommand("dd", ["if=/dev/zero", "of=.tegra/tegraLoopback.img", "bs=100M", "count=20"], true)
            await spawnCommand("losetup", ["-f", ".tegra/tegraLoopback.img"], true)
            console.log("Set up the loopback device!")
        })

        this.cleanupFunctions.push(() => {
            console.log("[CLEANUP] Detaching the loopback device...")
            exec("sudo losetup -D")
        })

        return this
    }

    /**
     * Runs the build process, finalizes all configurations, and generates the final image
     */
    public async build() {
        console.log("Beginning build...")
        for(let i = 0; i < this.buildFunctions.length; i++) {
            await this.buildFunctions[i]()
        }
        console.log("Built .tegra/tegraLoopback.img sucessfully!")
        process.exit(0)
    }

    public constructor() {
        process.on("exit", async (ExitCode) => {
            if(!this.cleanupEnabled) return

            for(let i = 0; i < this.cleanupFunctions.length; i++) {
                this.cleanupFunctions[i]()
            }

            process.exit(ExitCode)
        })
    }
}
