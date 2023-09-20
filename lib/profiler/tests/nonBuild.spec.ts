import { expect } from "chai"
import { ProfileParser } from "../src"
import { resolve } from "path"

describe("Profiler tests: non-build", function() {
    it("Removable profile parse test", function() {
        const profile = new ProfileParser("./assets/tests/profiler/nonBuild/inheritor/profile.yaml")

        expect(profile.profileData.name, "Name field").to.equal("Removable disk image profile")
        expect(profile.profileData.packages, "Package list").to.have.all.members([ "base", "linux", "linux-firmware", "refind", "nano", "vi", "vim" ])
        expect(profile.profileData.output?.bootloader?.kernelName, "Kernel name").to.equal("linux")
        expect(profile.profileData.output?.type, "Output type").to.equal("image")
        expect(profile.profileData.output?.bootloader?.type, "Bootloader type").to.equal("refind")
        expect(profile.profileData.patches?.patchFolders).to.have.all.members([ resolve(__dirname,"../profiles/refindPatches"), resolve(__dirname, "../profiles/basePatches") ])
    })
})
