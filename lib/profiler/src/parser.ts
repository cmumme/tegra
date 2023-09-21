import { accessSync, readFileSync } from "fs"
import { dirname, resolve } from "path"
import yaml from "yaml"
import { mergeDeep } from "./util/objectUtils"

const GLOBAL_PROFILE_ROOT = resolve(__dirname,"../profiles")

export interface profileData {
    name?: string,
    description?: string,
    inherits?: string[],
    packages?: string[],
    patches?: {
        patchFolders?: string[]
    },
    commands?: string[],
    output?: {
        type?: "image" | "disk",
        imageSize?: number,
        diskDevice?: string,
        swapPartition?: boolean,
        swapPartitionSize?: number,
        bootPartitionSize?: number,
        bootloader?: {
            type?: "refind",
            kernelName?: string,
            refindUseDefault?: boolean,
            refindAllDrivers?: boolean,
            grubRemovable?: boolean,
            grubBootloaderId?: string
        }
    },
    plugins?: string[]
}

export class ProfileParser {
    public profileData: profileData = { }
    public readonly rootProfilePath: string
    private readonly rootProfileData: profileData
    private readonly profilePath: string

    private applyInheritance() {
        if(!this.rootProfileData.inherits) return
        if(this.rootProfileData.inherits.length === 0) return

        let lastProfileData: profileData = { }
        this.rootProfileData.inherits.forEach((inheritedProfilePath) => {
            mergeDeep(lastProfileData, new ProfileParser(inheritedProfilePath).profileData)
        })

        this.profileData = lastProfileData
    }

    private resolvePathsIn(array: string[]) {
        return array.map((relativePatchFolderPath) => {
            return resolve(dirname(this.profilePath), relativePatchFolderPath)
        })
    }

    private resolvePaths() {
        if(this.rootProfileData.patches?.patchFolders) {
            this.rootProfileData.patches.patchFolders = this.resolvePathsIn(this.rootProfileData.patches.patchFolders)
        }
        if(this.rootProfileData.plugins) {
            this.rootProfileData.plugins = this.resolvePathsIn(this.rootProfileData.plugins)
        }
    }

    private parseProfile(yamlSource: string) {
        return yaml.parse(yamlSource) as profileData
    }

    private readFile(filePath: string) {
        let fileContents: string = ""
        try {
            fileContents = readFileSync(filePath, { encoding: "utf-8" })
        } catch(err) {
            throw new Error(`Failed to read profile ${filePath}: ${err}`)
        }
        return fileContents
    }

    private fileAccessible(filePath: string) {
        let exists = true
        try {
            accessSync(filePath)
        } catch {
            exists = false
        }
        return exists
    }

    public constructor(
        profileNameOrPath: string
    ) {
        const relativeProfilePath = resolve(profileNameOrPath)
        const tegraProfilePath = resolve(GLOBAL_PROFILE_ROOT, `${profileNameOrPath}.yaml`)

        if(this.fileAccessible(relativeProfilePath)) {
            // relative profiles (user-created stuff like ./myDistroBase.yaml)
            this.profilePath = profileNameOrPath
        } else if(this.fileAccessible(tegraProfilePath)) {
            // included tegra profiles in ../profiles relative to this file (base, linux, refind, etc)
            // no .yaml prefix required
            this.profilePath = tegraProfilePath
        }

        this.rootProfilePath = relativeProfilePath

        if(!this.profilePath) 
            throw new Error(
                `Error while parsing ${profileNameOrPath}: could not resolve profile ${profileNameOrPath} for inheritance.`
            )

        this.rootProfileData = this.parseProfile(
            this.readFile(this.profilePath)
        )
        this.resolvePaths()
        this.applyInheritance()
        mergeDeep(this.profileData, this.rootProfileData)
    }
}