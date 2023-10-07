import { expect } from "chai"
import { Sequence, Task } from "../src"
import { resolve } from "path"
import { randomUUID } from "crypto"
import { TegraBuilder } from "../../builder/src"

describe("TaskSys tests: non-build", function() {
    it("Task.fromConfig direct construction test", async function() {
        const builder = new TegraBuilder()
            .setQuiet(true, false)
        const uuid = randomUUID()
        const task = Task.fromConfig({
            use: "./assets/tests/tasksys/tasks/testTask.js",
            with: {
                value: uuid
            }
        }, builder)

        task.execute()
        await builder.build(false)

        expect(builder.fullLog).to.contain(uuid)
    })

    it("Sequence.fromFile direct construction test", async function() {
        const builder = new TegraBuilder()
            .setQuiet(true, false)
        const uuid = randomUUID()
        const sequence = Sequence.fromFile(
            resolve("./assets/tests/tasksys/test.seq.yaml"),
            builder
        )

        sequence.getTask("testTask").taskOptions = {
            value: uuid
        }

        sequence.execute()
        await builder.build(false)

        expect(sequence.name).to.equal("TaskSys test")
        expect(builder.fullLog, `./tasks/testTask.js log is as expected (uuid ${uuid})`).to.contain(
            `How's it going? My value: ${uuid}`
        )
        expect(builder.fullLog, "@tgra/tasks/example log is correct").to.contain(
            `Log from the @tgra/tasks/example task! Appended value is: ${
                sequence.getTask<{ append?: string }>("exampleTask").taskOptions.append
            }`
        )
    })
})
