# OpenRisk · Seven-minute live demo

Open the [private demo](https://corvus.gent/project-cto) at 1440×900 or a similar screen-share viewport. Enter the password from the brief before sharing your screen. A fresh browser session starts with an empty portfolio and workspace. Your demo inputs are scoped to that browser session.

| Time | Clicks | What to say |
| --- | --- | --- |
| 0:00–0:45 | Open **Explore**. Click the **Antwerp** and **Gent** city buttons and sort the list **By name** and **By score**. | “Start with the market. An investor can open a company dossier before the founder has entered a single KPI.” |
| 0:45–1:40 | Type **Aikido Security** and open its dossier. Point at **How the score is built**, evidence coverage and its financing source. Click **Follow**. | “Each observation has provenance. A missing source lowers coverage, and the weights are visible.” |
| 1:40–2:25 | Return to **Explore**, search **Deliverect**, then **Stripe**. Show **Belgian annual accounts** on Deliverect and **Financial signals** on Stripe. | “The same interface handles a Belgian enterprise record and a U.S. company disclosure.” |
| 2:25–3:05 | Type **Hugging Face** and click **Research Hugging Face**. Watch the source badges. | “The public dossier starts immediately, and sources settle independently.” |
| 3:05–4:30 | Back in **Explore**, search **Aikido Security**. Click **Claim this profile**. Load **September investor update**, click **Extract KPI proposals** and **Confirm all**. Repeat for **October investor update**. Show a highlighted sentence and the sample badge. | “Only the confirmed values become visible to investors. These two emails contain illustrative figures.” |
| 4:30–5:20 | Click **Investor fit** and show **Notion Capital**. Change **View as** to **Investor**. Open **Portfolio**, point to **4.6 mo** in red and **11%** MRR growth, then open Aikido’s KPI charts. | “The founder gets investment context. The investor gets a read-only evidence trail and comparable KPI history.” |
| 5:20–6:15 | In **Explore**, click **Add a startup**. Enter **Northstar Demo**, **example.com**, and **Gent**. Submit, switch **View as → Admin**, then click **Approve & enrich**. Back in Explore, search **Northstar Demo**. | “We can own the map. Submissions go through a review queue and approved records immediately join search.” |
| 6:15–7:00 | Point to sources and extraction quality in **Operations**. Use the lines below. | “We now have one flow from public discovery to private, founder-approved reporting.” |

## Live-source fallback

If an upstream service is slow, leave the cold dossier open until the ticker finishes or return to **Explore**. The Aikido, Deliverect and Stripe dossiers come from the authenticated snapshot and are independent of live source availability. If the founder-state service is unavailable, show the saved proposal and portfolio screenshots in [docs/demo-screens](docs/demo-screens).

## Architecture and roadmap

1. “Corvus serves a password-protected workspace, while the local index and persisted public snapshots keep discovery fast.”
2. “The inside-out layer turns a private email into proposed KPIs with provenance, a review boundary and an audit trail.”
3. “Phase two connects Gmail and Outlook with OAuth and binds confirmed values to the startup and its invited investors.”
4. “Phase three adds WhatsApp Business, accounting and CRM. Phase four benchmarks comparable cohorts and tests ML against the explainable baseline.”
5. “We can port preload and scoring to a Rust CLI first, then run the same JSON contract behind an Axum service for live enrichment.”
