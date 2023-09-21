import { constants, writeFileSync } from "fs"
import type { TegraBuilder } from ".."

export function dumpLog() {
    return function(self: TegraBuilder) {
        self.cleanupFunctions.push(() => {
            writeFileSync(".tegra/build.log", self.fullLog, {
                encoding: "utf-8",
                mode: constants.O_TRUNC
            })
        })
    }
}