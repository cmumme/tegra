import { TegraBuilder } from "./builder"

new TegraBuilder()
    .noCleanup()
    .createTegraFiles()
    .createLoopbackDevice()
    .createPartitions()
    .mountPartitions()
    .pacstrapPackages([
        "base", "linux", "linux-firmware", "refind", 
        "nano", "vi", "vim", "sudo"
    ])
    .generateFSTab()
    .applyPatch("./tests/basic/patches/opt/tegra-data.patch", "/opt/tegra-data")
    .applyPatch("./tests/basic/patches/etc/hostname.patch", "/etc/hostname")
    .applyPatch("./tests/basic/patches/etc/vconsole.conf.patch", "/etc/vconsole.conf")
    .applyPatch("./tests/basic/patches/boot/refind_linux.conf.patch", "/boot/refind_linux.conf")
    .executeCommand("ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime")
    .executeCommand("hwclock --systohc")
    .executeCommand("yes tegra | passwd root") // sets root passwd to tegra
    .installRefind({ useDefault: true, allDrivers: true })
    .build()
