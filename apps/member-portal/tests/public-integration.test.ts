import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
it("does not intercept the separate portal login as Squarespace account login", () => {
  const source = readFileSync("../../js/cnb-homepage.js", "utf8");
  const implementation = source.match(
    /const isLoginHref = \(href\) => \{[\s\S]*?\n  \};/,
  )?.[0];
  expect(implementation).toBeTruthy();
  const isLoginHref = runInNewContext(`${implementation}; isLoginHref`, {
    URL,
    window: { location: { origin: "https://www.cupcakesandbroccoli.com" } },
  });
  expect(isLoginHref("/login")).toBe(true);
  expect(isLoginHref("/account/login/")).toBe(true);
  expect(isLoginHref("https://members.cupcakesandbroccoli.com/login")).toBe(
    false,
  );
  expect(isLoginHref("//members.cupcakesandbroccoli.com/login")).toBe(false);
});
