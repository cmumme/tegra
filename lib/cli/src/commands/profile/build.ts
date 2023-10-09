import { program } from "commander"
import { resolve } from "path"
import { ProfileParser, ProfileCompositor } from "@tgra/profiler"
import { log } from "../../utils/log"
import ora from "ora"
import chalk from "chalk"

program
    .command("profile:build")
    .description("Builds a profile")
    .argument("<profile-path>", "the path to the profile to build")
    .option("-v", "--verbose")
    .action(async (profilePath, flags: { v: boolean }) => {
        const resolvedProfilePath = resolve(profilePath)
        const profileParser = new ProfileParser(resolvedProfilePath)
        const profileCompositor = new ProfileCompositor(profileParser, !flags.v)
        const buildOutput = profileParser.profileData.output?.type === "disk" ?
            profileParser.profileData.output.diskDevice :
            ".tegra/tegraBuild.img"
        const profileName = profileParser.profileData.name ?? profilePath
        const spinner = ora({
            text: `${chalk.yellow("working")} Building "${profileName}" to ${buildOutput}...`
        })

        log.info(`Initializing Tegra build settings`)
        profileCompositor.init()
        log.info(`Initialized build settings`)
        spinner.start()
        await profileCompositor.build().catch((err) => {
            spinner.fail(`${chalk.red("error")} Build failed:\n${err}`)
            process.exit(1)
        }).then(() => {
            spinner.succeed(`${chalk.green("success")} Build success! Output: ${buildOutput}`)
        })
    })
