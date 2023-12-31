import { expect } from "chai"
import { TegraBuilder, createPartitions, generateFSTab, installRefind, mountPartitions, useImage } from "../src"
import { access } from "fs/promises"
import { execSync } from "child_process"

describe("Builder tests: build", function() {
    it("Removable image test", async function() {
        if(!process.env.ENABLE_BUILD_TESTS) return this.skip()

        this.timeout(500*1000) // 300 seconds timeout for this build, typical is 100 seconds

        const builder = new TegraBuilder()
            .noCleanup() // Cleanup is done manually in the after() hook
            .setQuiet(process.env.LOUD_BUILD_TESTS !== "true")
            .createTegraFiles()
            .enableSwap(1)
            .add(useImage(5))
            .add(createPartitions())
            .add(mountPartitions())
            .pacstrapPackages([
                "base", "linux", "linux-firmware", "refind", 
                "nano", "vi", "vim"
            ])
            .add(generateFSTab())
            .applyPatch("./assets/tests/builder/removable/patches/etc/hostname", "/etc/hostname")
            .applyPatch("./assets/tests/builder/removable/patches/etc/vconsole.conf", "/etc/vconsole.conf")
            .applyPatch("./assets/tests/builder/removable/patches/boot/refind_linux.conf", "/boot/refind_linux.conf")
            .executeCommand("ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime")
            .executeCommand("hwclock --systohc")
            .executeCommand("yes tegra | passwd root")
            .add(installRefind({ useDefault: true, allDrivers: true }))

        after(async () => {
            builder.cleanup()
            execSync("sudo rm -rf .tegra/")
        })

        await builder.build()
        expect(async () => await access("./.tegra/tegraBuild.img"), "Image build fragment exists").to.not.throw()
    })
})