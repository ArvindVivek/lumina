import { expect, test, type Page } from "@playwright/test"

// Fixture ids: Leviatán vs Cloud9, VCT Americas Stage 2 2025 playoffs (lib/data/fixtures/matches.json).
const SERIES = "2843060"
const LEV = "1611"
const C9 = "79"
const GAME = "1bd3eda3-5917-4daf-978c-84c16b81bfc2"
const PLANTED_ROUND = `${GAME}_2`
const OXY = "10636"

/** Fails the test on any console error or uncaught exception (hydration errors included). */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  return errors
}

const PAGES: [string, RegExp][] = [
  ["/", /Every round, explained/],
  ["/tournaments", /Tournaments/],
  ["/tournaments/826992", /Stage 2 2025 Playoffs/],
  [`/series/${SERIES}`, /Leviatán Esports vs Cloud9/],
  [`/game/${GAME}`, /Corrode/],
  ["/teams", /Teams/],
  ["/players", /Players/],
  ["/analytics", /vs/],
  [`/analytics?series=${SERIES}&team=${C9}`, /Leviatán Esports vs Cloud9/],
  ["/player-analytics", /Player insights/],
  [`/player-analytics?player=${OXY}`, /OXY/],
  ["/macro-review", /Team review/],
  [`/macro-review?team=${C9}`, /Cloud9/],
  ["/scenario-analysis", /Scenario lab/],
  ["/debug", /About the data/],
]

for (const [path, heading] of PAGES) {
  test(`page ${path} loads with data and no errors`, async ({ page }) => {
    const errors = watchErrors(page)
    const res = await page.goto(path)
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
    await expect(page.getByText(/Made by/)).toBeVisible()
    await expect(page.getByText(/Legal Jibber Jabber/)).toBeVisible()
    // Wait for client islands to settle, then check nothing complained.
    await page.waitForLoadState("networkidle")
    expect(errors).toEqual([])
    // Nothing may push the page sideways (wide tables scroll inside their own card).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("an unknown page is a themed 404", async ({ page }) => {
  const res = await page.goto("/series/does-not-exist")
  expect(res?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: /couldn't find that page/ })).toBeVisible()
})

test("every API route answers from the fixture", async ({ request }) => {
  const get = [
    "/api/stats", "/api/series", `/api/series/${SERIES}`, "/api/tournaments", "/api/teams", "/api/players", `/api/games/${GAME}`,
    `/api/context?page=series&seriesId=${SERIES}`,
    `/api/analytics/coaching-report/${SERIES}?team_focus=${C9}`,
    `/api/analytics/round-breakdown/${SERIES}?team_focus=${C9}`,
    `/api/analytics/round-decision/${PLANTED_ROUND}`,
    `/api/analytics/hypothetical/${PLANTED_ROUND}`,
    ...["critical-moments", "economy", "first-blood", "opening-duels", "pistol", "round-breakdown", "timing", "trading", "ultimates"].map((m) => `/api/macro-review/${m}/${LEV}`),
    ...["agent-performance", "clutch", "eco-round", "first-death", "multi-kill", "opening-duels", "trading"].map((m) => `/api/player-insights/${m}/${OXY}`),
  ]
  for (const url of get) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    expect(await res.json(), url).toBeTruthy()
  }
  const post: [string, object][] = [
    ["/api/scenarios/save-retake", { defender_economy: 0, defender_alive: 3, attacker_alive: 3 }],
    ["/api/scenarios/force-eco", { team_economy: 12000, opponent_economy: 20000 }],
    ["/api/scenarios/clutch", { clutch_player_count: 1, opponent_count: 2 }],
    ["/api/analytics/scenarios/find-similar", { attacker_alive: 3, defender_alive: 2, spike_planted: true }],
    ["/api/analytics/llm", { query_type: "round_analysis", round_id: PLANTED_ROUND }],
    ["/api/ask", { query: "How did Cloud9 do against Sentinels?" }],
    ["/api/chat", { messages: [{ role: "user", content: "Who wins opening duels?" }], page: { page: "series", seriesId: SERIES } }],
  ]
  for (const [url, body] of post) {
    const res = await request.post(url, { data: body })
    expect(res.status(), url).toBe(200)
  }
  expect((await request.post("/api/scenarios/save-retake", { data: { defender_alive: 9 } })).status()).toBe(400)
  expect((await request.get(`/api/series/nope`)).status()).toBe(404)
})

test("the series page leads to a map, and a planted round shows the retake check", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto(`/series/${SERIES}`)
  await page.getByRole("link", { name: /Corrode/ }).click()
  await expect(page).toHaveURL(new RegExp(`/game/${GAME}`))
  await page.getByRole("button", { name: /^2\s/ }).first().click()
  await expect(page.getByText("Kill feed")).toBeVisible()
  await expect(page.getByText(/When the spike went down it was/)).toBeVisible()
  await page.getByRole("button", { name: /Coach's take on this round/ }).click()
  await expect(page.getByText(/AI unavailable right now/)).toBeVisible()
  expect(errors).toEqual([])
})

test("the match report switches sides and writes a fallback review", async ({ page }) => {
  await page.goto(`/analytics?series=${SERIES}&team=${C9}`)
  await expect(page.getByText(/Cloud9 won 2-1 against Leviatán Esports/)).toBeVisible()
  await page.getByRole("link", { name: /Leviatán Esports/ }).first().click()
  await expect(page.getByText(/Leviatán Esports lost 1-2 against Cloud9/)).toBeVisible()
  await page.getByRole("button", { name: /Get the coach's review/ }).click()
  await expect(page.getByText(/Next:/)).toBeVisible()
})

test("pickers change the player and the team", async ({ page }) => {
  await page.goto("/player-analytics")
  await page.getByLabel("Player").selectOption(OXY)
  await expect(page).toHaveURL(new RegExp(`player=${OXY}`))
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OXY")
  await page.goto("/macro-review")
  await page.getByLabel("Team").selectOption(LEV)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Leviatán Esports")
  await expect(page.getByText("Rounds to rewatch")).toBeVisible()
})

test("players can be searched", async ({ page }) => {
  await page.goto("/players")
  await page.getByLabel("Search players or teams").fill("oxy")
  await expect(page.getByRole("link", { name: /OXY/ })).toBeVisible()
  await page.getByLabel("Search players or teams").fill("zzzz")
  await expect(page.getByText("No players match")).toBeVisible()
})

test("the scenario lab answers each question", async ({ page }) => {
  await page.goto("/scenario-analysis")
  await page.getByRole("button", { name: "Check the history" }).click()
  await expect(page.getByText(/similar post-plant rounds/)).toBeVisible()
  await page.getByRole("button", { name: "Clutch odds" }).click()
  await page.getByRole("button", { name: "Check the history" }).click()
  await expect(page.getByText(/Pros won .* clutches/)).toBeVisible()
})

test("the coach answers with numbers when the AI is unavailable", async ({ page }) => {
  await page.goto(`/series/${SERIES}`)
  await page.getByRole("button", { name: "Ask the coach" }).click()
  await page.getByLabel("Your question").fill("Who won the opening duels?")
  await page.getByRole("button", { name: "Send question" }).click()
  await expect(page.getByText(/AI unavailable: showing the numbers/)).toBeVisible()
  await expect(page.getByText(/Leviatán Esports vs Cloud9\./)).toBeVisible()
  await page.getByRole("button", { name: "Close the coach" }).click()
  await expect(page.getByRole("button", { name: "Ask the coach" })).toBeVisible()
})

test("the theme toggle switches to dark", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Switch to dark mode/ }).first().click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})

test("on phones the menu opens and navigates", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone navigation only")
  await page.goto("/")
  await page.getByRole("button", { name: "Open menu" }).click()
  await page.locator("#phone-menu").getByRole("link", { name: "Teams" }).click()
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
  // No sideways scrolling on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
