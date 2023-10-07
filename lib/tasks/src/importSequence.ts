import type { TegraBuilder } from "@tgra/builder"
import { Sequence, Task } from "@tgra/tasksys"
import { resolve } from "path"

interface TaskOptions {
    sequenceFile?: string,
    taskOptions?: Record<string, object>
}

/*
    This task creates a sequence from a file, applies options to its tasks based on taskOptions,
    and finally executes the sequence on the current builder.
*/
export default function(builder: TegraBuilder, options: TaskOptions, callingTask: Task) {
    const sequence = Sequence.fromFile(
        resolve(
            callingTask.rootDir,
            options.sequenceFile
        ),
        builder
    )

    // Assign options from taskOptions to the sequence's tasks based on taskId
    // (which is the key of an element in taskOptions)
    Object.entries(options.taskOptions).forEach(([taskId, taskOptions]) => {
        sequence.getTask(taskId).taskOptions = taskOptions
    })

    sequence.execute()
}