import { exec } from "child_process"
import type { TegraBuilder } from ".."

/**
 * Creates an image and a corresponding loopback device and assigns it as the target disk
 * 
 * @param imageSize The total size of the full image in GB
 */
export function useImage(imageSize = 5) {
    return function(self: TegraBuilder) {
        self.targetDevice = "/dev/loop0"
        self.partPrefix = "p"
        self.bootPartitionDevice = `${self.targetDevice}${self.partPrefix}1`

        if(self.swapEnabled) {
            self.swapPartitionDevice = `${self.targetDevice}${self.partPrefix}2`
            self.rootPartitionDevice = `${self.targetDevice}${self.partPrefix}3`
        } else {
            self.rootPartitionDevice = `${self.targetDevice}${self.partPrefix}2`
        }

        self.buildFunctions.push(async () => {
            self.log("Setting up loopback device...")
            await self.spawnCommand("losetup", ["-D"], true)
            await self.spawnCommand("dd", ["if=/dev/zero", "of=.tegra/tegraBuild.img", "bs=100M", `count=${imageSize*10}`], true)
            await self.spawnCommand("losetup", ["-f", ".tegra/tegraBuild.img"], true)
            self.log("Set up the loopback device!")
        })

        self.cleanupFunctions.push(() => {
            self.log("[CLEANUP] Detaching the loopback device...")
            exec("sudo losetup -D")
        })
    }
}

/**
 * Sets the target disk device to ``diskDevice`` and sets up the partition map
 * 
 * @param diskDevice The disk device to use (e.g /dev/sdb)
 */
export function useDisk(diskDevice: string) {
    return function(self: TegraBuilder) {
        self.targetDevice = diskDevice
        self.bootPartitionDevice = `${self.targetDevice}${self.partPrefix}1`
        if(self.swapEnabled) {
            self.swapPartitionDevice = `${self.targetDevice}${self.partPrefix}2`
            self.rootPartitionDevice = `${self.targetDevice}${self.partPrefix}3`
        } else {
            self.rootPartitionDevice = `${self.targetDevice}${self.partPrefix}2`
        }
    }
}