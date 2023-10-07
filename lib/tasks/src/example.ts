import type { TegraBuilder } from "@tgra/builder"

interface TaskOptions {
    append?: string
}

export default function(builder: TegraBuilder, options: TaskOptions) {
    builder.buildFunctions.push(async () => {
        builder.log(`Log from the @tgra/tasks/example task! Appended value is: ${
            options.append ?? "nothing"
        }`)
    })
}