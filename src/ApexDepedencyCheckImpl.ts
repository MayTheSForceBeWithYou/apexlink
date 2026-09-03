import { execFile } from 'child_process';
import { promisify } from 'util';
import findJavaHome from 'find-java-home';
import ExecuteCommand from '@n8codes/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand';
import { Logger, LoggerLevel } from '@n8codes/sfp-logger';
import SFPLogger from '@n8codes/sfp-logger';
import { ConsoleLogger } from '@n8codes/sfp-logger';
import * as fs from 'fs-extra';
import path from 'path';

const execFileAsync = promisify(execFile);
const MIN_JAVA_MAJOR = 21;
const jarFile = path.join(__dirname, '..', 'jars', '*');

export default class ApexDepedencyCheckImpl {
    public constructor(private logger: Logger, private projectDirectory: string) {}

    public async execute() {
        let apexLinkProcessExecutor = new ExecuteCommand(this.logger, LoggerLevel.INFO, false);
        let generatedCommand = await this.getGeneratedCommandWithParams();

        await apexLinkProcessExecutor.execCommand(generatedCommand, process.cwd());
        let result = fs.readJSONSync(`${this.projectDirectory}/apexlink.json`);
        return result;
    }

    private async getGeneratedCommandWithParams() {
        let javaHome: string = await this.getJavaHome();
        const javaExecutable = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        let command = `"${javaExecutable}" -cp "${jarFile}" "io.github.apexdevtools.apexls.DependencyReport" -f json -w "${this.projectDirectory}" > "${this.projectDirectory}/apexlink.json"`;
        return command;
    }

    /**
     * Finds a Java 21+ home. Prefers JAVA_HOME, then find-java-home, then common install dirs.
     */
    private async getJavaHome(): Promise<string> {
        const candidates = await this.collectJavaHomeCandidates();

        for (const home of candidates) {
            const major = await this.readJavaMajorVersion(home);
            if (major !== null && major >= MIN_JAVA_MAJOR) {
                SFPLogger.log(`Java HOME ${home} (major ${major})`, LoggerLevel.TRACE, new ConsoleLogger());
                return home;
            }
        }

        throw new Error(
            `ApexLink requires Java ${MIN_JAVA_MAJOR} or later (bundled apex-ls JARs use class file version 65). ` +
                `Set JAVA_HOME to a JDK ${MIN_JAVA_MAJOR}+ install. ` +
                (candidates.length
                    ? `Checked: ${candidates.join(', ')}`
                    : 'No Java installation was found.')
        );
    }

    private async collectJavaHomeCandidates(): Promise<string[]> {
        const seen = new Set<string>();
        const add = (home?: string | null) => {
            if (!home) {
                return;
            }
            const resolved = path.resolve(home);
            if (fs.existsSync(path.join(resolved, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
                seen.add(resolved);
            }
        };

        add(process.env.JAVA_HOME);

        try {
            add(await this.findJavaHomeAsync());
        } catch {
            // continue with other candidates
        }

        for (const home of this.scanCommonJdkHomes()) {
            add(home);
        }

        return [...seen];
    }

    private findJavaHomeAsync(): Promise<string> {
        return new Promise<string>((resolve, reject): void => {
            findJavaHome({ allowJre: true }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }

    private scanCommonJdkHomes(): string[] {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const roots = [
            path.join(programFiles, 'Java'),
            path.join(programFiles, 'Microsoft'),
            path.join(programFiles, 'Eclipse Adoptium'),
            path.join(programFiles, 'Amazon Corretto'),
            path.join(programFiles, 'Zulu'),
            path.join(programFiles, 'BellSoft'),
            path.join(process.env.USERPROFILE || '', '.jdks'),
        ];

        const homes: string[] = [];
        for (const root of roots) {
            if (!fs.existsSync(root)) {
                continue;
            }
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                if (!entry.isDirectory()) {
                    continue;
                }
                const name = entry.name.toLowerCase();
                if (name.includes('jdk') || name.includes('zulu') || name.startsWith('jdk-')) {
                    homes.push(path.join(root, entry.name));
                }
            }
        }
        return homes;
    }

    private async readJavaMajorVersion(javaHome: string): Promise<number | null> {
        const javaExecutable = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
        try {
            const { stdout, stderr } = await execFileAsync(javaExecutable, ['-version'], {
                timeout: 10000,
            });
            const output = `${stderr}${stdout}`;
            const match = output.match(/version\s+"([0-9]+)(?:\.([0-9]+))?/);
            if (!match) {
                return null;
            }
            const first = Number(match[1]);
            if (first === 1 && match[2]) {
                return Number(match[2]);
            }
            return first;
        } catch {
            return null;
        }
    }
}
