import chalk from "chalk"
import { program } from "commander"
import { resolve } from "path"
import { ProfileParser } from "@tgra/profiler"

program
    .command("profile:parse")
    .description("Parses a profile fully (applies properties from inherited profiles) and returns the result as JSON encoded output")
    .argument("<profile-path>", "The path to the profile to parse")
    .action((profilePath) => {
        const resolvedProfilePath = resolve(profilePath)

        console.log(JSON.stringify(new ProfileParser(resolvedProfilePath).profileData, undefined, 4))
    })
