import type { ProfileCompositor } from "@tgra/profiler"

export default class {
    public isMyTestPlugin = "Hello, world! I am!"
    public ranAfterBootloaderInstall = false

    public constructor(
        public profileCompositor: ProfileCompositor
    ) {
        profileCompositor.afterBootloaderInstall.add(() => {
            this.ranAfterBootloaderInstall = true
        })
    }
}