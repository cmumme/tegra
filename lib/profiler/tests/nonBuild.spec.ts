import { expect } from "chai"
import { ProfileCompositor, ProfileParser } from "../src"
import { resolve } from "path"

describe("Profiler tests: non-build", function() {
    it("Removable profile parse test", function() {
        const profile = new ProfileParser("./assets/tests/profiler/nonBuild/inheritor/profile.yaml")

        expect(profile.profileData.name, "Name field").to.equal("Removable disk image profile")
        expect(profile.profileData.packages, "Package list").to.have.all.members([ "linux", "linux-firmware", "refind", "nano", "vi", "vim" ])
        expect(profile.profileData.output?.bootloader?.kernelName, "Kernel name").to.equal("linux")
        expect(profile.profileData.output?.type, "Output type").to.equal("image")
        expect(profile.profileData.output?.bootloader?.type, "Bootloader type").to.equal("refind")
        expect(profile.profileData.patches?.patchFolders).to.have.all.members([ resolve(__dirname,"../profiles/refindPatches"), resolve(__dirname, "../profiles/basePatches") ])
    })

    it("Plugin loading test", async function() {
        const profile = new ProfileParser("./assets/tests/profiler/nonBuild/inheritor/profile.yaml")
        const compositor = new ProfileCompositor(profile, true)
        compositor.init()
        const testPlugin = compositor.plugins[1] as any

        expect(testPlugin?.isMyTestPlugin, "correct plugin loaded").to.equal("Hello, world! I am!")
        expect(testPlugin?.ranAfterBootloaderInstall, "afterBootloaderInstall hook").to.equal(true)
    })
})
