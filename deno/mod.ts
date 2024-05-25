import { EMPTY } from "@gnome/strings";
import type { ChildProcess, CommandOptions, CommandStatus, Output, Signal } from "../types.d.ts";
import { type CommandArgs, convertCommandArgs } from "../command-args.ts";
import { Command, ShellCommand } from "../command.ts";
import { remove, removeSync } from "@gnome/fs";

class DenoChildProcess implements ChildProcess {
    #childProcess: Deno.ChildProcess;
    #options: CommandOptions;

    constructor(childProcess: Deno.ChildProcess, options: CommandOptions) {
        this.#childProcess = childProcess;
        this.#options = options;
    }

    get stdin(): WritableStream<Uint8Array> {
        return this.#childProcess.stdin;
    }

    get stdout(): ReadableStream<Uint8Array> {
        return this.#childProcess.stdout;
    }

    get stderr(): ReadableStream<Uint8Array> {
        return this.#childProcess.stderr;
    }

    get pid(): number {
        return this.#childProcess.pid;
    }

    get status(): Promise<CommandStatus> {
        return this.#childProcess.status;
    }

    ref(): void {
        return this.#childProcess.ref();
    }

    unref(): void {
        return this.#childProcess.unref();
    }

    async output(): Promise<Output> {
        const out = await this.#childProcess.output();

        return new DenoOutput({
            stdout: this.#options.stdout === "piped" ? out.stdout : new Uint8Array(0),
            stderr: this.#options.stderr === "piped" ? out.stderr : new Uint8Array(0),
            code: out.code,
            signal: out.signal,
            success: out.success,
        });
    }

    kill(signo?: Signal): void {
        return this.#childProcess.kill(signo);
    }

    onDispose: (() => void) | undefined;

    [Symbol.asyncDispose](): Promise<void> {
        if (this.onDispose) {
            this.onDispose();
        }

        return this.#childProcess[Symbol.asyncDispose]();
    }
}

class DenoOutput implements Output {
    #text?: string;
    #lines?: string[];
    #json?: unknown;
    #errorText?: string;
    #errorLines?: string[];
    #errorJson?: unknown;
    readonly stdout: Uint8Array;
    readonly stderr: Uint8Array;
    readonly code: number;
    readonly signal?: string | undefined;
    readonly success: boolean;

    constructor(output: Deno.CommandOutput) {
        this.stdout = output.stdout;
        this.stderr = output.stderr;
        this.code = output.code;
        this.signal = output.signal as string;
        this.success = output.success;
    }

    text(): string {
        if (this.#text) {
            return this.#text;
        }

        if (this.stdout.length === 0) {
            this.#text = EMPTY;
            return this.#text;
        }

        this.#text = new TextDecoder().decode(this.stdout);
        return this.#text;
    }

    lines(): string[] {
        if (this.#lines) {
            return this.#lines;
        }

        this.#lines = this.text().split(/\r?\n/);
        return this.#lines;
    }

    json(): unknown {
        if (this.#json) {
            return this.#json;
        }

        this.#json = JSON.parse(this.text());
        return this.#json;
    }
    errorText(): string {
        if (this.#errorText) {
            return this.#errorText;
        }

        if (this.stderr.length === 0) {
            this.#errorText = EMPTY;
            return this.#errorText;
        }

        this.#errorText = new TextDecoder().decode(this.stderr);
        return this.#errorText;
    }

    errorLines(): string[] {
        if (this.#errorLines) {
            return this.#errorLines;
        }

        this.#errorLines = this.errorText().split(/\r?\n/);
        return this.#errorLines;
    }

    errorJson(): unknown {
        if (this.#errorJson) {
            return this.#errorJson;
        }

        this.#errorJson = JSON.parse(this.errorText());
        return this.#errorJson;
    }

    toString(): string {
        return this.text();
    }
}

export class DenoCommand extends Command {
    constructor(exe: string, args?: CommandArgs, options?: CommandOptions) {
        super(exe, args, options);
    }

    outputSync(): Output {
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

        options.stdout ??= "piped";
        options.stderr ??= "piped";
        options.stdin ??= "inherit";

        const process = new Deno.Command(this.file, options);
        const out = process.outputSync();

        return new DenoOutput({
            stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
            stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
            code: out.code,
            signal: out.signal,
            success: out.success,
        });
    }

    async output(): Promise<Output> {
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

        options.stdout ??= "piped";
        options.stderr ??= "piped";
        options.stdin ??= "inherit";

        const process = new Deno.Command(this.file, options);
        const out = await process.output();

        return new DenoOutput({
            stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
            stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
            code: out.code,
            signal: out.signal,
            success: out.success,
        });
    }

    spawn(): ChildProcess {
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

        const process = new Deno.Command(this.file, options);
        return new DenoChildProcess(process.spawn(), options);
    }
}

export class DenoShellCommand extends ShellCommand {
    outputSync(): Output {
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }

            const options = {
                ...this.options,
                args: args,
            };

            options.stdout ??= "piped";
            options.stderr ??= "piped";
            options.stdin ??= "inherit";

            const process = new Deno.Command(this.file, options);
            const out = process.outputSync();

            return new DenoOutput({
                stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            });
        } finally {
            if (isFile && generated) {
                removeSync(file);
            }
        }
    }

    async output(): Promise<Output> {
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }

            const options = {
                ...this.options,
                args: args,
            } as Deno.CommandOptions;

            options.stdout ??= "piped";
            options.stderr ??= "piped";
            options.stdin ??= "inherit";

            const process = new Deno.Command(this.file, options);
            const out = await process.output();

            return new DenoOutput({
                stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            });
        } finally {
            if (isFile && generated) {
                await remove(file);
            }
        }
    }

    spawn(): ChildProcess {
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        const args = this.getShellArgs(isFile ? file : this.script, isFile);
        if (isFile && this.args) {
            const splat = convertCommandArgs(this.args);
            args.push(...splat);
        }

        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

        const process = new Deno.Command(this.file, options);
        const proc = new DenoChildProcess(process.spawn(), options);
        proc.onDispose = () => {
            if (isFile && generated) {
                removeSync(file);
            }
        };
        return proc;
    }
}
