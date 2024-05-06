import {} from "./node/shim.ts";
import {
    assert as ok,
    assertEquals as equals,
    assertFalse as no,
    assertNotEquals as notEquals,
} from "jsr:@std/assert@0.225.0";
import { Command } from "./base.ts";
import { WINDOWS } from "@gnome/os-constants";
import { which } from "./which.ts";
import { env } from "@gnome/env";

const echo = await which("echo");
const ls = await which("ls");

Deno.test("Command with simple output", async () => {
    if (WINDOWS) {
        const cmd = new Command("where.exe", ["deno.exe"]);
        const output = await cmd.output();
        equals(output.code, 0);
        ok(output.text().trim().endsWith("deno.exe"));
    } else {
        const cmd = new Command("which", ["deno"]);
        const output = await cmd.output();
        equals(output.code, 0);
        ok(output.text().trim().endsWith("deno"));
        equals(output.lines().length, 2);
    }
});

Deno.test({
    name: "Command with inherit returns no output",
    fn: async () => {
        const cmd = new Command("echo", ["hello"], { stdout: "inherit" });
        const output = await cmd.output();
        equals(output.code, 0);
        equals(output.stdout.length, 0);
        equals(output.text(), "");
    },
    ignore: !echo,
});

Deno.test({
    name: "Command with bad command returns error",
    fn: async () => {
        const cmd = new Command("git", ["clone"], { stderr: "piped", stdout: "piped" });
        const output = await cmd.output();
        ok(output.code !== 0);
        notEquals(output.stderr.length, 0);
        notEquals(output.errorText(), "");
    },
    ignore: !echo,
});

Deno.test({
    name: "Command that sets cwd",
    fn: async () => {
        const cmd2 = new Command("ls", ["-l"], { cwd: "." });
        const output2 = await cmd2.output();
        equals(output2.code, 0);
        ok(output2.text().includes("base.ts"));

        const home = env.get("HOME") || env.get("USERPROFILE") || ".";
        const cmd = new Command("ls", ["-l"], { cwd: home });
        const output = await cmd.output();
        equals(output.code, 0);
        no(output.text().includes("base.ts"));
    },
    ignore: !ls,
});

Deno.test({
    name: "Command with spawn with default options",
    fn: async () => {
        const cmd = new Command("echo", ["hello"]);
        const process = await cmd.spawn();
        const output = await process.output();
        equals(output.code, 0);
        // should default to inherits
        equals(output.stdout.length, 0);
    },
});

Deno.test({
    name: "Command with spawn with piped options",
    fn: async () => {
        const cmd = new Command("echo", ["hello"], {
            stdout: "piped",
            stderr: "piped",
        });
        const process = await cmd.spawn();
        const output = await process.output();
        equals(output.code, 0);
        // should default to inherits
        equals(output.stdout.length, 6);
    },
    ignore: !echo,
});
