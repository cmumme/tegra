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
        swapPartition?: boolean,
        swapPartitionSize?: number,
        bootPartitionSize?: number,
        bootloader?: {
            type?: "refind",
            kernelName?: string
        }
    }
}

export class ProfileParser {
    public profileData: profileData = { }
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

    private resolvePaths() {
        if(!this.rootProfileData.patches?.patchFolders) return
        if(this.rootProfileData.patches.patchFolders.length === 0) return

        this.rootProfileData.patches.patchFolders = this.rootProfileData.patches.patchFolders.map((relativePatchFolderPath) => {
            return resolve(dirname(this.profilePath), relativePatchFolderPath)
        })
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