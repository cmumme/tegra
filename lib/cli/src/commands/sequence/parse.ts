import { program } from "commander"
import { resolve } from "path"
import { Sequence } from "@tgra/tasksys"

program
    .command("sequence:parse")
    .description("Parses a sequence fully without building it")
    .argument("<sequence-path>", "The path to the sequence to parse")
    .action((sequencePath) => {
        const resolvedSequencePath = resolve(sequencePath)

        console.log(
            JSON.stringify(
                Sequence.fromFile(resolvedSequencePath),
                undefined,
                4
            )
        )
    })
