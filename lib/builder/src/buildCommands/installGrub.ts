import type { TegraBuilder } from ".."

/**
 * Installs and configures the GRUB bootloader on the target system.
 * 
 * @param options The options to use when setting up GRUB
 */
export function installGrub({ removable = false, bootloaderId = "TEGRA" }) {
    return function(self: TegraBuilder) {
        self.buildFunctions.push(async () => {
            self.log(`Installing GRUB${removable ? " in removable mode" : ""} with ID "${bootloaderId}"...`)

            await self.spawnChrootCommand(`grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id="${bootloaderId}" ${removable ? "--removable" : ""}`)
            await self.spawnChrootCommand("grub-mkconfig -o /boot/grub/grub.cfg")

            self.log("Installed GRUB!")
        })
    }
}