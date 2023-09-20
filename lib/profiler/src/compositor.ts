import {
    TegraBuilder, installGrub, installRefind, useDisk,
    useImage, createPartitions, mountPartitions, generateFSTab
} from "@tgra/builder"
import { ProfileParser, profileData } from "."
import { readdir } from "fs/promises"
import { readdirSync } from "fs"
import { extname, relative, resolve } from "path"
import { MiniSignal } from "mini-signals"

export interface plugin {

}

export class ProfileCompositor {
    public beforeDiskSetup = new MiniSignal()
    public beforePackageInstall = new MiniSignal()
    public beforeCommandExecution = new MiniSignal()
    public beforePatch = new MiniSignal()
    public beforeBootloaderInstall = new MiniSignal()
    public afterBootloaderInstall = new MiniSignal()
    public beforeFinalBuild = new MiniSignal()
    
    public plugins: plugin[] = [ ]

    public readonly builder: TegraBuilder
    public readonly profileData: profileData
    private initialized = false

    public constructor(
        public readonly profilerParser: ProfileParser,
        public readonly quiet = false
    ) {
        this.builder = new TegraBuilder()
        this.profileData = this.profilerParser.profileData
    }

    /**
     * Loads any plugins specified in profileData.plugins
     */
    private initPlugins() {
        if(!this.profileData.plugins) return
        if(Object.values(this.profileData.plugins).length === 0) return

        Object.values(this.profileData.plugins).map(pluginName => {
            const pluginConstructor = require(resolve(this.profilerParser.rootProfilePath, pluginName))
            const pluginInstance = new pluginConstructor.default(this) as plugin

            this.plugins.push(pluginInstance)
        })
    }

    /**
     * Sets up the builder configuration and loads plugins, does not have any filesystem side effects. 
     * 
     * Call ``.build()`` after calling ``.init()`` to apply changes.
     * 
     * @returns Promise
     */
    public init() {
        if(this.initialized) return

        this.initPlugins()

        this.builder.setQuiet(this.quiet)
        this.builder.createTegraFiles()
        this.profileData.output?.swapPartition && this.builder.enableSwap(
            this.profileData.output.swapPartitionSize ?? 1
        )

        this.beforeDiskSetup.dispatch()
        // Disk setup/partitioning
        if(this.profileData.output?.type === "disk" && !this.profileData.output.diskDevice)
            throw new Error("Output type 'disk' was specified with no output disk device specified, please specify a disk device.")
        this.profileData.output?.type === "disk" ? 
            this.builder.add(useDisk(this.profileData.output.diskDevice)) :
            this.builder.add(useImage(this.profileData.output?.imageSize))
        this.builder
            .add(createPartitions(this.profileData.output?.bootPartitionSize))
            .add(mountPartitions())
        
        this.beforePackageInstall.dispatch()
        
        this.builder
            .pacstrapPackages(this.profileData.packages ?? [ ])
            .add(generateFSTab())

        this.beforeCommandExecution.dispatch()
        this.profileData.commands?.forEach((command) => {
            this.builder.executeCommand(command)
        })

        this.beforePatch.dispatch()
        this.profileData.patches.patchFolders.forEach((patchFolderPath) => {
            readdirSync(patchFolderPath, { recursive: true, encoding: "utf-8" }).forEach((patchPath: string) => {
                if(!(extname(patchPath) === ".patch")) return 

                this.builder.applyPatch(resolve(patchFolderPath, patchPath), resolve("/",patchPath.slice(0, -".patch".length)))
            })
        })

        this.beforeBootloaderInstall.dispatch()
        this.profileData.output?.bootloader?.type === "refind" ?
            this.builder.add(installRefind({
                useDefault: this.profileData.output.bootloader.refindUseDefault ?? false,
                allDrivers: this.profileData.output.bootloader.refindAllDrivers ?? false
            })) :
            this.builder.add(installGrub({
                removable: this.profileData.output.bootloader.grubRemovable ?? false,
                bootloaderId: this.profileData.output.bootloader.grubBootloaderId ?? "TEGRA"
            }))
        this.afterBootloaderInstall.dispatch()
        this.initialized = true

        return this
    }

    public async build() {
        if(!this.initialized) throw new Error("Please call ProfileCompositor.init() before calling build()")

        this.beforeFinalBuild.dispatch()
        return await this.builder.build()
    }
}