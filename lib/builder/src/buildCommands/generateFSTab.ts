import { execSync } from "child_process"
import type { TegraBuilder } from ".."

/**
 * Generates /etc/fstab on the target system based on the currently mounted partitions.
 */
export function generateFSTab() {
    return function(self: TegraBuilder) {
        self.buildFunctions.push(async () => {
            self.log("Generating FSTab...")
            await self.spawnCommand("mkdir", ["-p", ".tegra/rootfs/etc"], true)
            execSync("sudo sh -c \"genfstab -U .tegra/rootfs >> .tegra/rootfs/etc/fstab\"")
            self.log("Generated and wrote FSTab!")
        })
    }
}