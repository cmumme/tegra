import type { TegraBuilder } from "@tgra/builder"
import { basename, dirname, resolve } from "path"

/**
 * The function that will perform the operations on
 * a target ``TegraBuilder`` for a task.
 */
export type TaskFunction<T extends object = object> = (
    /**
     * The builder to perform operations on.
     */
    builder: TegraBuilder,
    /**
     * The options passed to this task, as found in the ``with``
     * property of a ``TaskConfig``.
     */
    options: T
) => void

/**
 * The definition of a task, as found in a sequence YAML file.
 */
export interface TaskConfig<T extends object = object> {
    /**
     * The module that exports the ``TaskFunction`` to run for
     * this task.
     * 
     * Must be node.js resolvable like ``./tasks/myCustomTask.js``
     * or ``@tgra/tasks/init``.
     */
    use?: string,
    /**
     * A unique identifier used to reference this task
     * programatically.
     */
    id?: string,
    /**
     * The configuration used to customize this behavior of
     * this task's ``TaskFunction``.
     */
    with?: T
}

/**
 * An entity that uses ``TaskFunction``s like the ones provided by
 * ``@tgra/tasks`` to peform operations on a ``TegraBuilder``.
 */
export class Task<T extends object = object> {
    /**
     * Creates a ``Task`` based on a ``TaskConfig``
     * 
     * @param config The configuration to use for this task
     * @returns The created ``Task``
     */
    public static fromConfig<T extends object = object>(
        config: TaskConfig<T>,
        builder: TegraBuilder,
        rootDir = "."
    ): Task {
        let taskFunction: TaskFunction<T>

        try {
            /*
                This is basically a jank way of getting:
                ${rootDir}/node_modules/@tgra/tasks/out/example
                from:
                @tgra/tasks/example
                while still being applicable to custom task library modules
            */
            if(!taskFunction) taskFunction = require(
                resolve(
                    rootDir,
                    "node_modules",
                    dirname(config.use),
                    "out",
                    basename(config.use)
                )
            ).default
        } catch { }
        try {
            // And this one is for stuff like ./tasks/myTask.js
            if(!taskFunction) taskFunction = require(
                resolve(
                    rootDir,
                    config.use
                )
            ).default
        } catch { }
        if(!taskFunction) throw new Error(`Could not find task function file ${config.use}.`)

        return new Task(
            builder,
            taskFunction,
            config.with,
            config.id
        )
    }

    public constructor(
        public readonly builder: TegraBuilder,
        public readonly taskFunction: TaskFunction,
        public taskOptions: T,
        public readonly taskId?: string
    ) { }

    /**
     * Executes this task's ``TaskFunction`` with the proper arguments.
     * 
     * @returns The output from the ``TaskFunction``
     */
    public execute() {
        return this.taskFunction(
            this.builder,
            this.taskOptions
        )
    }
}
