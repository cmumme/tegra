import {
    TegraBuilder, installGrub, installRefind, useDisk,
    useImage, createPartitions, mountPartitions, generateFSTab
} from "@tgra/builder"
import { profileData } from "."
import { readdir } from "fs/promises"
import { readdirSync } from "fs"
import { extname, relative, resolve } from "path"

export class ProfileCompositor {
    public readonly builder: TegraBuilder
    private initialized = false

    public constructor(
        public readonly profileData: profileData,
        public readonly quiet = false
    ) {
        this.builder = new TegraBuilder()
    }

    /**
     * Sets up the builder configuration, does not have any filesystem side effects. 
     * 
     * Call ``.build()`` after calling ``.init()`` to apply changes.
     * 
     * @returns this
     */
    public init() {
        if(this.initialized) return

        this.builder.setQuiet(this.quiet)
        this.builder.createTegraFiles()
        this.profileData.output?.swapPartition && this.builder.enableSwap(
            this.profileData.output.swapPartitionSize ?? 1
        )

        // Disk setup/partitioning
        if(this.profileData.output?.type === "disk" && !this.profileData.output.diskDevice)
            throw new Error("Output type 'disk' was specified with no output disk device specified, please specify a disk device.")
        this.profileData.output?.type === "disk" ? 
            this.builder.add(useDisk(this.profileData.output.diskDevice)) :
            this.builder.add(useImage(this.profileData.output?.imageSize))
        this.builder
            .add(createPartitions(this.profileData.output?.bootPartitionSize))
            .add(mountPartitions())
            .pacstrapPackages(this.profileData.packages ?? [ ])
            .add(generateFSTab())

        this.profileData.commands?.forEach((command) => {
            this.builder.executeCommand(command)
        })

        this.profileData.patches.patchFolders.forEach((patchFolderPath) => {
            readdirSync(patchFolderPath, { recursive: true, encoding: "utf-8" }).forEach((patchPath: string) => {
                if(!(extname(patchPath) === ".patch")) return 

                this.builder.applyPatch(resolve(patchFolderPath, patchPath), resolve("/",patchPath.slice(0, -".patch".length)))
            })
        })

        this.profileData.output?.bootloader?.type === "refind" ?
            this.builder.add(installRefind({
                useDefault: this.profileData.output.bootloader.refindUseDefault ?? false,
                allDrivers: this.profileData.output.bootloader.refindAllDrivers ?? false
            })) :
            this.builder.add(installGrub({
                removable: this.profileData.output.bootloader.grubRemovable ?? false,
                bootloaderId: this.profileData.output.bootloader.grubBootloaderId ?? "TEGRA"
            }))

        this.initialized = true

        return this
    }

    public async build() {
        if(!this.initialized) throw new Error("Please call ProfileCompositor.init() before calling build()")

        return await this.builder.build()
    }
}