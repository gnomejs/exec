import type { CommandArgs } from "./command-args.ts";
import type { ChildProcess, CommandOptions, Output } from "./types.d.ts";


export class Command {
    exe: string;
    args?: CommandArgs;
    options?: CommandOptions;

    constructor(exe: string, args?: CommandArgs, options?: CommandOptions) {
        this.exe = exe;
        this.args = args;
        this.options = options ?? {};
    }

    withCwd(value: string | URL): this {
        this.options ??= {};
        this.options.cwd = value;
        return this;
    }

    withEnv(value: Record<string, string>): this {
        this.options ??= {};
        this.options.env = value;
        return this;
    }

    withUid(value: number): this {
        this.options ??= {};
        this.options.uid = value;
        return this;
    }

    withGid(value: number): this {
        this.options ??= {};
        this.options.gid = value;
        return this;
    }

    withSignal(value: AbortSignal): this {
        this.options ??= {};
        this.options.signal = value;
        return this;
    }

    withArgs(value: CommandArgs): this {
        this.args = value;
        return this;
    }

    output(): Promise<Output> {
        throw new Error("Not implemented");
    }
    outputSync(): Output {
        throw new Error("Not implemented");
    }
    
    spawn(): ChildProcess {
        throw new Error("Not implemented");
    }
}
