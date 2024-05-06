/**
 * The exec module provides cross-runtime functionality for invoke
 * executables.  A unified API is created for deno, node, bun
 * to executables such as but not limited to git, which, echo, etc.
 *
 * The API is influenced by Deno's `Deno.Command` api with some ehancements
 * such as providing `which` and `whichSync` and converting string or objects
 * into an array of arguments for the excutable.
 *
 * ## Basic Usage
 *
 * ```typescript
 * import { Command, run, output, type SplatObject, which } from "@gnome/exec";
 *
 * // string, array, or objects can be used for "args".
 * const cmd1 = new Command("git", "show-ref master", {
 *     env: { "MY_VAR": "TEST" },
 *     cwd: "../parent"
 * });
 * const output = await cmd1.output();
 *
 * console.log(output); // ->
 * // {
 * //    code: 0,
 * //    signal: undefined,
 * //    success: true
 * //    stdout: Uint8Array([01, 12..])
 * //    stderr: Uint8Array([0])
 * // }
 *
 * // the output result has different methods on it..
 * console.log(output.text()) // text
 * console.log(output.lines()) // string[]
 * console.log(output.json()) // will throw if output is not valid json
 *
 * // output is the short hand for new Command().output()
 * // and output defaults stdout and stderr to 'piped'
 * // which returns the output as Uint8Array
 * const text = await output("git", ["show-ref", "master"]).then(o => o.text())
 * console.log(text);
 *
 * // using splat objects only makes sense for complex cli with many
 * // arguments so that you can create interfaces that provide type info and
 * // intellisense for users.
 * export interface DotnetBuild extends SplatObject {
 *     project: string
 *     verbosity?: string
 * }
 *
 * const dotnet = await which("dotnet")
 *
 * if (dotnet) {
 *     // run will set stdout and stderr to 'inherit'
 *     // and execute the command.  'inherit' sets the output
 *     // to be written node, bun, deno's stdout.
 *     // dotnet build . --verbosity minimal
 *     await run(dotnet, {
 *        project: ".",
 *         verbosity: "minimal",
 *         splat: {
 *             command: ["build"]
 *         }
 *     } as DotnetBuild);
 * }
 * ```
 * @module
 */

export * from "./types.d.ts";
export * from "./command-args.ts";
export * from "./splat.ts";
export * from "./split-arguments.ts";
export * from "./base.ts";
export * from "./which.ts";
