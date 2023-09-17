
process.on("SIGINT", () => {
    process.exit(1)
})

process.on("uncaughtException", () => {
    process.exit(1)
})

export * from "./builder"