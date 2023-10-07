exports.default = function(builder, options) {
    builder.buildFunctions.push(async () => {
        builder.log(`How's it going? My value: ${options.value ?? "default"}`)
    })
}