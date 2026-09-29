// Screenshots for review: node scripts/shoot.mjs <outDir> <baseURL> <path>... (light and dark, phone and desktop)
import { chromium } from "@playwright/test"
const [out, base, ...paths] = process.argv.slice(2)
const browser = await chromium.launch()
const errors = []
for (const theme of ["light", "dark"]) {
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: name === "phone" ? 2 : 1, colorScheme: theme, timezoneId: "America/Los_Angeles" })
    const page = await ctx.newPage()
    page.on("console", (m) => m.type() === "error" && errors.push(`${theme}/${name} ${page.url()}: ${m.text()}`))
    page.on("pageerror", (e) => errors.push(`${theme}/${name} ${page.url()}: ${e.message}`))
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: "networkidle" })
      await page.waitForTimeout(300)
      const file = `${out}/${name}-${theme}-${p.replace(/[/?=&]+/g, "_") || "home"}.png`
      await page.screenshot({ path: file, fullPage: true })
    }
    await ctx.close()
  }
}
await browser.close()
console.log(errors.length ? errors.join("\n") : "no console errors")
