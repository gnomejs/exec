import type { ChildProcess, CommandOptions, CommandStatus, Output, Signal } from "../types.d.ts";
import { type ChildProcess as Node2ChildProcess, type IOType, spawn, spawnSync } from "node:child_process";
import { type CommandArgs, convertCommandArgs } from "../command-args.ts";
import { Command } from "../command.ts";

interface NodeCommonOutput {
    stdout: Uint8Array;
    stderr: Uint8Array;
    code: number;
    signal?: string;
    success: boolean;
}

export class NodeOutput implements Output {
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

    constructor(output: NodeCommonOutput) {
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
            this.#text = "";
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
            this.#errorText = "";
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

class NodeChildProcess implements ChildProcess {
    readonly #child: Node2ChildProcess;
    #stdout?: ReadableStream<Uint8Array>;
    #stderr?: ReadableStream<Uint8Array>;
    #stdin?: WritableStream<Uint8Array>;
    #status: Promise<CommandStatus>;

    constructor(child: Node2ChildProcess, signal?: AbortSignal) {
        this.#child = child;

        if (signal !== undefined) {
            signal.addEventListener("abort", () => {
                child.kill("SIGTERM");
            });
        }

        this.#status = new Promise<CommandStatus>((resolve, reject) => {
            child.on("error", (_err) => {
                reject(_err);
            });

            child.on("exit", (code, signal) => {
                resolve({
                    success: code === 0,
                    code: code || 1,
                    signal: signal,
                });
            });
        });
    }

    get pid(): number {
        return this.#child.pid ? this.#child.pid : -1;
    }

    get status(): Promise<CommandStatus> {
        return this.#status;
    }

    get stdout(): ReadableStream<Uint8Array> {
        if (this.#stdout) {
            return this.#stdout;
        }

        const child = this.#child;
        if (child.stdout === null) {
            throw new Error("stdout is not available");
        }

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                if (child.stdout === null) {
                    controller.close();
                    return;
                }

                child.stdout.on("data", (data) => {
                    controller.enqueue(data);
                });

                child.stdout.on("end", () => {
                    controller.close();
                });
            },
        });

        this.#stdout = stream;
        return stream;
    }

    get stderr(): ReadableStream<Uint8Array> {
        const child = this.#child;
        if (child.stderr === null) {
            throw new Error("stderr is not available");
        }

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                if (child.stderr === null) {
                    controller.close();
                    return;
                }

                child.stderr.on("data", (data) => {
                    controller.enqueue(data);
                });

                child.stderr.on("end", () => {
                    controller.close();
                });
            },
        });

        return stream;
    }

    get stdin(): WritableStream<Uint8Array> {
        if (this.#stdin) {
            return this.#stdin;
        }

        const child = this.#child;
        if (child.stdin === null) {
            throw new Error("stdin is not available");
        }

        const stream = new WritableStream<Uint8Array>({
            write(chunk) {
                child.stdin?.write(chunk);
            },
        });

        this.#stdin = stream;
        return stream;
    }

    kill(signo?: Signal | undefined): void {
        if (signo === "SIGEMT") {
            signo = "SIGTERM";
        }

        this.#child.kill(signo);
    }

    ref(): void {
        this.#child.ref();
    }

    unref(): void {
        this.#child.unref();
    }

    output(): Promise<Output> {
        let stdout = new Uint8Array(0);
        let stderr = new Uint8Array(0);

        this.#child.stdout?.on("data", (data) => {
            stdout = new Uint8Array([...stdout, ...data]);
        });

        this.#child.stderr?.on("data", (data) => {
            stderr = new Uint8Array([...stderr, ...data]);
        });

        return new Promise<Output>((resolve, reject) => {
            this.#child.on("error", (err) => {
                reject(err);
            });

            this.#child.on("exit", (code, signal) => {
                const o = {
                    stdout: stdout,
                    stderr: stderr,
                    code: code,
                    signal: signal,
                    success: code === 0,
                } as NodeCommonOutput;

                resolve(new NodeOutput(o));
            });
        });
    }

    async [Symbol.asyncDispose](): Promise<void> {
        await this.status;
    }
}

export class NodeCommand extends Command {
    constructor(exe: string, args: CommandArgs, options: CommandOptions) {
        super(exe, args, options);
    }

    runSync(): Output {
        const args = this.args ? convertCommandArgs(this.args) : [];

        const o = {
            ...this.options,
            stdio: "pipe",
        };

        const child = spawnSync(this.exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: ["ignore", "inherit", "inherit"],
            windowsVerbatimArguments: o.windowsRawArguments,
        });

        const code = child.status ? child.status : 1;
        return new NodeOutput({
            stdout: new Uint8Array(0),
            stderr: new Uint8Array(0),
            code: child.status ? child.status : 1,
            signal: child.signal,
            success: code === 0,
        } as NodeCommonOutput);
    }

    async output(): Promise<Output> {
        const args = this.args ? convertCommandArgs(this.args) : [];

        console.log(this.exe);
        console.log(args);
        let signal: AbortSignal | undefined;
        if (this.options?.signal) {
            signal = this.options.signal;
        }

        const o = this.options ?? {};

        o.stdin ??= "inherit";
        o.stdout ??= "piped";
        o.stderr ??= "piped";

        const child = spawn(this.exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
            windowsVerbatimArguments: o.windowsRawArguments,
            // deno-lint-ignore no-explicit-any
            signal: signal as any,
        });

        let stdout = new Uint8Array(0);
        let stderr = new Uint8Array(0);

        let code = 1;
        let sig: string | Signal | undefined;

        const promises: Promise<void>[] = [];
        if (child.stdout !== null) {
            child.stdout.on("data", (data) => {
                stdout = new Uint8Array([...stdout, ...data]);
            });
        }

        if (child.stderr !== null) {
            child.stderr.on("data", (data) => {
                stderr = new Uint8Array([...stderr, ...data]);
            });
        }

        promises.push(
            new Promise<void>((resolve) => {
                if (child.stdout === null) {
                    resolve();
                    return;
                }

                child.stdout.on("end", () => {
                    resolve();
                });
            }),
        );

        promises.push(
            new Promise<void>((resolve) => {
                if (child.stderr === null) {
                    resolve();
                    return;
                }

                child.stderr.on("end", () => {
                    resolve();
                });
            }),
        );

        promises.push(
            new Promise<void>((resolve) => {
                child.on("exit", (c, s) => {
                    code = c !== null ? c : 1;
                    sig = s === null ? undefined : s;
                    resolve();
                });
            }),
        );

        await Promise.all(promises);

        return new NodeOutput({
            stdout: stdout,
            stderr: stderr,
            code: code,
            signal: sig,
            success: code === 0,
        } as NodeCommonOutput);
    }

    outputSync(): Output {
        const args = this.args ? convertCommandArgs(this.args) : [];

        const o = {
            ...this.options,
        };

        o.stdin ??= "inherit";
        o.stdout ??= "piped";
        o.stderr ??= "piped";

        const child = spawnSync(this.exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
            windowsVerbatimArguments: o.windowsRawArguments,
        });

        const code = child.status ? child.status : 1;
        return new NodeOutput({
            stdout: new Uint8Array(0),
            stderr: new Uint8Array(0),
            code: child.status ? child.status : 1,
            signal: child.signal,
            success: code === 0,
        } as NodeCommonOutput);
    }

    spawn(): ChildProcess {
        const args = this.args ? convertCommandArgs(this.args) : [];

        const o = {
            ...this.options,
        };
        o.stdout ??= "inherit";
        o.stderr ??= "inherit";
        o.stdin ??= "inherit";
        const stdin = mapPipe(o.stdin);
        const stdout = mapPipe(o.stdout);
        const stderr = mapPipe(o.stderr);

        const child = spawn(this.exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [stdin, stdout, stderr],
            windowsVerbatimArguments: o.windowsRawArguments,
        });

        return new NodeChildProcess(child, o.signal);
    }
}

function mapPipe(pipe: "inherit" | "null" | "piped" | undefined): IOType | null | undefined {
    if (pipe === undefined) {
        return undefined;
    }

    if (pipe === "inherit") {
        return "inherit";
    }
    if (pipe === "null") {
        return "ignore";
    }
    if (pipe === "piped") {
        return "pipe";
    }
    return undefined;
}
