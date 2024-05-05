import type { CommandArgs } from "./command-args.ts";
import { Command as CommandType } from "./command.ts";
import type { CommandOptions } from "./types.d.ts";
// deno-lint-ignore no-explicit-any
const g = globalThis as any;

let Command = CommandType;
if (g.process) {
    Command = (await import("./node/mod.ts")).NodeCommand;
} else if (g.Deno) {
    Command = (await import("./deno/mod.ts")).DenoCommand;
} else {
    throw new Error("Unsupported runtime");
}

export { Command };

export function run(exe: string, args?: CommandArgs, options?: Omit<CommandOptions, 'stderr' | 'stdout'>) {
    const o = (options || {}) as CommandOptions;
    o.stderr = "inherit";
    o.stdout = "inherit";

    return new Command(exe, args, o).output();
}

export function runSync(exe: string, args?: CommandArgs, options?: Omit<CommandOptions, 'stderr' | 'stdout'>) {
    const o = (options || {}) as CommandOptions;
    o.stderr = "inherit";
    o.stdout = "inherit";

    return new Command(exe, args, options).outputSync();
}

export function output(exe: string, args?: CommandArgs, options?: CommandOptions) {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "piped";
    options.stdout ??= "piped";
    return new Command(exe, args, options).output();
}

export function outputSync(exe: string, args?: CommandArgs, options?: CommandOptions) {
    options ??= {};
    options.stderr = "piped";
    options.stdout = "piped";
    return new Command(exe, args, options).outputSync();
}

export function spawn(exe: string, args?: CommandArgs, options?: CommandOptions) {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "inherit";
    options.stdout ??= "inherit";

    return new Command(exe, args, options).spawn();
}