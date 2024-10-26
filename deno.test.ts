import { expect } from "jsr:@std/expect";

const { test } = Deno

test("can check if using deno", () => {
    expect(Deno).toBeDefined();
});

test("can make a fetch() request", async () => {
    const response = await fetch("https://example.com/");
    expect(response.ok).toBe(true);
    await response.body?.cancel();
});

test('cdn import (esm)', async () => {
    const { add } = await import("https://cdn.jsdelivr.net/npm/lodash-es/+esm");
    expect(add(2, 2)).toBe(4);
});
