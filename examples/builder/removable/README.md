# Bare-minimum low-level @tgra/builder example
The following code creates an bootable UEFI image (intended for flashing to a removable drive) with the rEFInd bootloader, some end-user packages, (``nano``, ``vi``, and ``vim``) and a root account with password ``tegra``. It yields a fully bootable .img, nearly identical to if you followed the [Arch Installation Guide](https://wiki.archlinux.org/title/Installation_guide) all the way through the end and installed the rEFInd bootloader. (does not contain a swap partition)

```ts
import { TegraBuilder } from "@tgra/builder"

// TegraBuilder is the base class that holds all logic you should need for customizing and generating
// a new system. You use "builder commands" to describe how the system is generated and customized,
// and when .build() is executed all builder commands are finalized, executed, and the "target disk,"
// (in this case a loopback device that points to ./.tegra/tegraLoopback.img) is written to with the
// final, bootable system. Any cleanup commands are executed after .build() is finished, including
// unmounting the rootfs, and in this case detaching the loopback device. The end result is a fully
// bootable system, and in this case a .img file that can be flashed to a removable drive and booted.
new TegraBuilder()
    // Creates the ./.tegra folder, not necessarily needed but it's best practice to implement this
    // just in case on of the following builder commands doesn't automatically generate it
    .createTegraFiles()
    // Enables and sets the swap size to 1 GB
    .enableSwap(1)
    // Creates a .img file (./.tegra/tegraLoopback.img) and loopback device, and sets it as the 
    // target disk
    .useImage(5)
    // Partitions and formats the target disk (in this case, the loopback device)
    .createPartitions()
    // Mounts the partitions to ``./.tegra/rootfs``
    .mountPartitions()
    // Pacstraps the basic packages, (base, linux, linux-firmware) the rEFInd bootloader installer,
    // and some text editors (nano, vi, vim)
    .pacstrapPackages([
        "base", "linux", "linux-firmware", "refind", 
        "nano", "vi", "vim"
    ])
    // Generates and writes the new system's FS table with swap (if it's enabled), boot, and root 
    // partitions
    .generateFSTab()
    // Sets the hostname to ``tegra``. (or whatever is in hostname.patch) The Tegra builder runs off 
    // of packages, commands, and patches. Patches are used to edit/create any file in the new system
    // that isn't a package, and can't be conventionally achieved with a command execution in chroot
    .applyPatch("./patches/etc/hostname.patch", "/etc/hostname")
    // Configures the console keymap to us (or whatever is in vconsole.conf.patch)
    .applyPatch("./patches/etc/vconsole.conf.patch", "/etc/vconsole.conf")
    // The following patch is used as a base for any kernel options, and the real partition UUIDs 
    // will be filled out when .installRefind() is run
    .applyPatch("./patches/boot/refind_linux.conf.patch", "/boot/refind_linux.conf")
    // Configuring date & time settings with the following two commands
    .executeCommand("ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime")
    .executeCommand("hwclock --systohc")
    // Sets the root user's password to ``tegra``. You could alternatively lock the root user, and
    // configure a new user (make sure to setup sudo!!)
    .executeCommand("yes tegra | passwd root")
    // Installs and configures the rEFInd bootloader, with the --usedefault and --alldrivers options
    // for maximum compatibility with removable drives
    .installRefind({ useDefault: true, allDrivers: true })
    // Finally executes all builder commands and writes the result to the target disk
    // (tegraLoopback.img)
    .build()
```
