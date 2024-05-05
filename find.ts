import { equalsIgnoreCase } from "@gnome/strings";
import { env } from "@gnome/env";
import { underscore } from "jsr:@gnome/strings@^0.1.0/inflections";
import { which, whichSync } from "./which.ts";
import { isFile, isFileSync } from "@gnome/fs";
import { DARWIN, WINDOWS } from "@gnome/os-constants";


export interface PathFinderOptions {
    name: string;
    executable?: string;
    envVariable?: string;
    cached?: string;
    paths?: string[];
    windows?: string[];
    linux?: string[];
    darwin?: string[];
}

/**
 * Represents a path finder that allows storing and retrieving path finder options.
 */
export class PathFinder {
    #map: Map<string, PathFinderOptions>;

    constructor() {
        this.#map = new Map();
    }

    /**
     * Sets the path finder options for a given name.
     * @param name - The name of the path finder.
     * @param options - The path finder options.
     */
    set(name: string, options: PathFinderOptions) {
        this.#map.set(name, options);
    }

    /**
     * Retrieves the path finder options for a given name.
     * @param name - The name of the path finder.
     * @returns The path finder options, or undefined if not found.
     */
    get(name: string): PathFinderOptions | undefined {
        return this.#map.get(name);
    }

    /**
     * Checks if a path finder with the given name exists.
     * @param name - The name of the path finder.
     * @returns True if the path finder exists, false otherwise.
     */
    has(name: string): boolean {
        return this.#map.has(name);
    }

    /**
     * Deletes the path finder with the given name.
     * @param name - The name of the path finder.
     * @returns True if the path finder was deleted, false otherwise.
     */
    delete(name: string): boolean {
        return this.#map.delete(name);
    }

    /**
     * Clears all path finders.
     */
    clear() {
        this.#map.clear();
    }

    /**
     * Finds the path finder options for a given name.
     * @param name - The name of the path finder.
     * @returns The path finder options, or undefined if not found.
     */
    find(name: string): PathFinderOptions | undefined {
        const options = this.get(name);
        if (!options) {
            return;
        }

        for (const [key, value] of this.#map) {
            if (value.name === name) {
                return value;
            }

            if (value.cached === name) {
                return value;
            }

            if (equalsIgnoreCase(key, name)) {
                return value;
            }
        }

        return undefined;
    }

    /**
     * Synchronously finds the executable path for a given name.
     * @param name - The name of the executable.
     * @returns The executable path, or undefined if not found.
     */
    async findExeSync(name: string): Promise<string | undefined> {
        let options = this.find(name);
        if (!options) {
            options = {
                name: name,
                envVariable: (underscore(name) + "_EXE").toUpperCase(),
            } as PathFinderOptions;

            this.set(name, options);
        }

        if (options?.envVariable) {
            let envPath = env.get(options.envVariable);
            if (envPath) {
                envPath = await which(envPath);
                if (envPath && await isFile(envPath)) {
                    return envPath;
                }
            }
        }

        if (options.cached) {
            return options.cached;
        }

        const defaultPath = await which(name);
        if (defaultPath && await isFile(defaultPath)) {
            options.cached = defaultPath;
            return defaultPath;
        }

        if (WINDOWS) {
            if (options.windows && options.windows.length) {
                for (const path of options.windows) {
                    let next = path;
                    next = env.expand(next);

                    if (await isFile(next)) {
                        options.cached = next;
                        return next;
                    }
                }
            }
        }

        if (DARWIN) {
            if (options.darwin && options.darwin.length) {
                for (const path of options.darwin) {
                    let next = path;
                    next = env.expand(next);

                    if (await isFile(next)) {
                        options.cached = next;
                        return next;
                    }
                }
            }
        }

        if (options.linux && options.linux.length) {
            for (const path of options.linux) {
                let next = path;
                next = env.expand(next);

                if (await isFile(next)) {
                    options.cached = next;
                    return next;
                }
            }
        }

        return undefined;
    }

    /**
     * Finds the executable path for a given name.
     * @param name - The name of the executable.
     * @returns The executable path, or undefined if not found.
     */
    findExe(name: string): string | undefined {
        let options = this.find(name);
        if (!options) {
            options = {
                name: name,
                envVariable: (underscore(name) + "_EXE").toUpperCase(),
            } as PathFinderOptions;

            this.set(name, options);
        }

        if (options?.envVariable) {
            let envPath = env.get(options.envVariable);
            if (envPath) {
                envPath = whichSync(envPath);
                if (envPath && isFileSync(envPath)) {
                    return envPath;
                }
            }
        }

        if (options.cached) {
            return options.cached;
        }

        const defaultPath = whichSync(name);
        if (defaultPath && isFileSync(defaultPath)) {
            options.cached = defaultPath;
            return defaultPath;
        }

        if (WINDOWS) {
            if (options.windows && options.windows.length) {
                for (const path of options.windows) {
                    let next = path;
                    next = env.expand(next);

                    if (isFileSync(next)) {
                        options.cached = next;
                        return next;
                    }
                }
            }
        }

        if (DARWIN) {
            if (options.darwin && options.darwin.length) {
                for (const path of options.darwin) {
                    let next = path;
                    next = env.expand(next);

                    if (isFileSync(next)) {
                        options.cached = next;
                        return next;
                    }
                }
            }
        }

        if (options.linux && options.linux.length) {
            for (const path of options.linux) {
                let next = path;
                next = env.expand(next);

                if (isFileSync(next)) {
                    options.cached = next;
                    return next;
                }
            }
        }

        return undefined;
    }
}

export const pathFinder = new PathFinder();