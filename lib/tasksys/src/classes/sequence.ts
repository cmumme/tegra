import { TegraBuilder } from "@tgra/builder"
import { Task, TaskConfig } from "./task"
import yaml from "yaml"
import { readFileSync } from "fs"
import { dirname } from "path"

/**
 * The definition of a sequence, as found in a sequence YAML file.
 */
export interface SequenceConfig {
    /**
     * The human-readable name of this sequence.
     */
    name?: string,
    /**
     * The array of tasks involved in this sequence.
     */
    tasks: TaskConfig[]
}

/**
 * An entity that compiles a list of ``Task``s into a single entity that can be executed to perform
 * operations on a single ``TegraBuilder``.
 */
export class Sequence {
    /**
     * Creates a ``Sequence`` based on a YAML formatted UTF-8 encoded file.
     * 
     * @param filePath The path of the file to create a sequence from
     * @param builder The builder to use for this sequence
     * @returns The created ``Sequence``
     */
    public static fromFile(
        filePath: string,
        builder = new TegraBuilder()
    ): Sequence {
        return Sequence.fromString(
            readFileSync(
                filePath,
                {
                    encoding: "utf-8"
                }
            ),
            builder,
            dirname(filePath)
        )
    }

    /**
     * Creates a ``Sequence`` based on a YAML string.
     * 
     * @param yamlString The string to create a sequence from, in YAML format
     * @param builder The builder to use for this sequence
     * @param rootDir The root directory to resolve task paths from
     * @returns The created ``Sequence``
     */
    public static fromString(
        yamlString: string,
        builder = new TegraBuilder(),
        rootDir = "."
    ): Sequence {
        return Sequence.fromConfig(
            yaml.parse(yamlString),
            builder,
            rootDir
        )
    }

    /**
     * Creates a ``Sequence`` based on a ``SequenceConfig``.
     * 
     * @param config The configuration to use for this sequence
     * @param builder The builder to use for this sequence
     * @param rootDir The root directory to resolve task paths from
     * @returns The created ``Sequence``
     */
    public static fromConfig(
        seqConfig: SequenceConfig,
        builder = new TegraBuilder(),
        rootDir = "."
    ): Sequence {
        return new Sequence(
            seqConfig.tasks.map((taskConfig: TaskConfig) => {
                return Task.fromConfig(
                    taskConfig,
                    builder,
                    rootDir
                )
            }),
            builder,
            seqConfig.name
        )
    }

    public constructor(
        public readonly tasks: Task[],
        public readonly builder = new TegraBuilder(),
        public readonly name?: string
    ) { }

    /**
     * Executes each of this sequence's tasks.
     * 
     * @returns An array of the results from each task's function
     */
    public execute() {
        return this.tasks.map((task) => {
            return task.execute()
        })
    }

    /**
     * Finds a task by its unique ID.
     * 
     * @param taskId The ID of the task to get
     * @returns The task that was found
     */
    public getTask<T extends object = object>(taskId: string): Task<T> {
        return this.tasks.find((task) => task.taskId === taskId) as Task<T>
    }
}
