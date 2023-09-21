exports.default = class {
    constructor(self) {
        self.afterDiskSetup.add(() => {
            self.builder.pacstrapPackages([ "base" ])
        })
    }
}