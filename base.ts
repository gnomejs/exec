import type { CommandArgs } from "./command-args.ts";
import { Command as CommandType } from "./command.ts";
import type { ChildProcess, CommandOptions, Output } from "./types.d.ts";
// deno-lint-ignore no-explicit-any
const g = globalThis as any;

/**
 * The implementation of the {@linkcode CommandType} to run.
 */
let Command = CommandType;
if (g.process) {
    Command = (await import("./node/mod.ts")).NodeCommand;
} else if (g.Deno) {
    Command = (await import("./deno/mod.ts")).DenoCommand;
} else {
    throw new Error("Unsupported runtime");
}

export { Command };

export function run(
    exe: string,
    args?: CommandArgs,
    options?: Omit<CommandOptions, "stderr" | "stdout">,
): Promise<Output> {
    const o = (options || {}) as CommandOptions;
    o.stderr = "inherit";
    o.stdout = "inherit";

    return new Command(exe, args, o).output();
}

export function runSync(exe: string, args?: CommandArgs, options?: Omit<CommandOptions, "stderr" | "stdout">): Output {
    const o = (options || {}) as CommandOptions;
    o.stderr = "inherit";
    o.stdout = "inherit";

    return new Command(exe, args, options).outputSync();
}

export function output(exe: string, args?: CommandArgs, options?: CommandOptions): Promise<Output> {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "piped";
    options.stdout ??= "piped";
    return new Command(exe, args, options).output();
}

export function outputSync(exe: string, args?: CommandArgs, options?: CommandOptions): Output {
    options ??= {};
    options.stderr = "piped";
    options.stdout = "piped";
    return new Command(exe, args, options).outputSync();
}

export function spawn(exe: string, args?: CommandArgs, options?: CommandOptions): ChildProcess {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "inherit";
    options.stdout ??= "inherit";

    return new Command(exe, args, options).spawn();
}
