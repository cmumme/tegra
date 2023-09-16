
process.on("SIGINT", () => {
    process.exit(2)
})

process.on("uncaughtException", () => {
    process.exit(2)
})

export * from "./builder"