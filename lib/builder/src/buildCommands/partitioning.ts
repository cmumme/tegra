import { exec } from "child_process"
import type { TegraBuilder } from ".."

/**
 * Mounts partitions to .tegra/rootfs (and any applicable subdirectories),
 * and enables swap if needed.
 */
export function mountPartitions() {
    return function(self: TegraBuilder) {
        self.buildFunctions.push(async () => {
            self.log("Mounting partitions...")
            await self.spawnCommand("mount", [self.rootPartitionDevice, ".tegra/rootfs"], true)
            if(self.swapEnabled) {
                await self.spawnCommand("swapon", [self.swapPartitionDevice])
            }
            await self.spawnCommand("mount", ["-m", self.bootPartitionDevice, ".tegra/rootfs/boot"], true)
            self.log("Mounted partitions!")
        })

        self.cleanupFunctions.push(() => {
            self.log("[CLEANUP] Unmounting partitions...")
            exec("sudo umount .tegra/rootfs/boot") // async callback rejects, as these will be used when exiting the process
            exec("sudo umount .tegra/rootfs")
            exec("sudo umount -l .tegra/rootfs")
            if(!self.swapEnabled) return
            self.log("[CLEANUP] Turning off swap partition...")
    
            exec(`swapoff ${self.swapPartitionDevice}`)
        })
    }
}

/**
 * Creates the GPT partition table on the target disk, partitions it with a boot
 * and primary partition and optionally a swap partition if enableSwap() was called),
 * and formats them to be used in the mountPartitions() build command.
 * 
 * @param bootPartitionSize The size of the boot partition in MiB
 */
export function createPartitions(bootPartitionSize = 512) {
    return function(self: TegraBuilder) {
        if(!self.bootPartitionDevice)
            throw new Error(`No boot partition device has been assigned, ensure you have a useLoopbackDevice or useDisk build command.`)
        if(!self.rootPartitionDevice)
            throw new Error(`No boot partition device has been assigned, ensure you have a useLoopbackDevice or useDisk build command.`)

        self.buildFunctions.push(async () => {
            self.log("Partitioning and formatting...")
            await self.spawnCommand("parted", ["-s", self.targetDevice, "mktable", "GPT"], true)
            if(self.swapEnabled) {
                await self.spawnCommand("parted", [
                    "-s", "-a", "optimal", self.targetDevice, 
                    "mkpart", "Boot", "fat32", "0%", `${bootPartitionSize}`,
                    // Swap partition will be formatted with mkswap later
                    "mkpart", "Swap", "ext4", `${bootPartitionSize}`, `${bootPartitionSize+self.swapSize}`,
                    "mkpart", "Primary", "ext4", `${bootPartitionSize+self.swapSize}`, "100%"
                ], true)
            } else {
                await self.spawnCommand("parted", [
                    "-s", "-a", "optimal", self.targetDevice, 
                    "mkpart", "Boot", "fat32", "0%", `${bootPartitionSize}`,
                    "mkpart", "Primary", "ext4", `${bootPartitionSize}`, "100%"
                ], true)
            }
            await self.spawnCommand("mkfs.fat", ["-F", "32", self.bootPartitionDevice], true)
            if(self.swapEnabled) {
                await self.spawnCommand("mkswap", [self.swapPartitionDevice])
            }
            await self.spawnCommand("mkfs.ext4", [self.rootPartitionDevice], true)
            self.log("Partitioned and formatted successfully!")
        })
    }
}