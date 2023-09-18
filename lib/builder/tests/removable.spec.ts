import { expect } from "chai"
import { TegraBuilder } from "../src"
import { access } from "fs/promises"
import { execSync } from "child_process"

describe("Builder tests", () => {
    it("Removable image full build test", async function() {
        this.timeout(500*1000) // 300 seconds timeout for this build, typical is 100 seconds

        const builder = new TegraBuilder()
            .noCleanup() // Cleanup is done manually in the after() hook
            .setQuiet(true)
            .createTegraFiles()
            .enableSwap(1)
            .useImage(5)
            .createPartitions()
            .mountPartitions()
            .pacstrapPackages([
                "base", "linux", "linux-firmware", "refind", 
                "nano", "vi", "vim"
            ])
            .generateFSTab()
            .applyPatch("./assets/tests/builder/removable/patches/etc/hostname.patch", "/etc/hostname")
            .applyPatch("./assets/tests/builder/removable/patches/etc/vconsole.conf.patch", "/etc/vconsole.conf")
            .applyPatch("./assets/tests/builder/removable/patches/boot/refind_linux.conf.patch", "/boot/refind_linux.conf")
            .executeCommand("ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime")
            .executeCommand("hwclock --systohc")
            .executeCommand("yes tegra | passwd root")
            .installRefind({ useDefault: true, allDrivers: true })

        after(async () => {
            //builder.cleanup()
            //execSync("sudo rm -rf .tegra/")
        })

        await builder.build()
        expect(async () => await access("./.tegra/tegraBuild.img"), "Image build fragment exists").to.not.throw()
    })
})