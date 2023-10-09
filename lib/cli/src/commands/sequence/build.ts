import { program } from "commander"
import { resolve } from "path"
import { Sequence } from "@tgra/tasksys"

program
    .command("sequence:build")
    .description("Builds a sequence fully")
    .argument("<sequence-path>", "The path to the sequence to build")
    .option("-v, --verbose", "verbose mode", false)
    .action((sequencePath, flags) => {
        const resolvedSequencePath = resolve(sequencePath)
        const sequence = Sequence.fromFile(resolvedSequencePath)

        sequence.builder.quiet = !flags.verbose
        
        sequence.execute()
        sequence.builder.build()
    })
