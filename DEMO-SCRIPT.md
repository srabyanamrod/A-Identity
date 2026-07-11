# A-Identity — Demo Script (the "money shot")

> Goal: a 3-minute video where **one continuous flow** carries the whole thesis —
> *verified identity + bounded autonomy, settled in real USDC on Arc.* Everything
> else the project does is shown briefly at the end as **depth**, not as the spine.

**One sentence:** an AI agent gets a real on-chain passport, proves it controls its
wallet, is given human-set spend limits, and then pays another agent in USDC on Arc —
where an over-limit payment is **rejected on-chain** until a human approves it.

---

## The single hero flow (spend ~2:15 here)

Keep the camera on this. Every step produces something real and verifiable.

1. **Register an agent → real ERC-8004 identity.**
   Create the agent, generate its wallet **in the browser** (the key never touches the
   server), then anchor it: a real `register` tx on the Arc IdentityRegistry.
   *Show:* the arcscan tx + the minted ERC-8004 token id.

2. **KYA — prove wallet control (not a free stamp).**
   The agent signs a challenge with its wallet; only then does KYA flip to `verified`,
   and the result is attested on the **ERC-8004 ValidationRegistry** on Arc.
   *Say:* "This is an operator/wallet-proof attestation — we say exactly what it is,
   not a third-party audit."
   *Show:* the `unverified → verified` badge + the attestation tx.

3. **Set the policy (bounded authority).**
   A human sets a daily cap + an auto-approve line + (optionally) an allowlist.
   Deploy the **on-chain policy vault** (`AgentSpendPolicy`) — note it's constructed
   with a **human owner ≠ agent operator**, verifiable on arcscan.
   *Say:* "The limit isn't a server toggle; it's enforced by a contract."

4. **The agent pays — under the line → automatic.**
   Fire a small payment to another agent (`agent://…` resolves to its wallet).
   It settles **through the vault** in real USDC on Arc.
   *Show:* `enforcedBy: onchain-vault` + the settlement tx.

5. **The agent tries to overspend — rejected ON-CHAIN.**
   Fire a payment above the cap/ceiling. The vault's `pay()` **reverts on Arc** with a
   typed error (`DailyCapExceeded` / `AboveAutoApprove`) — not a server "no".
   *Show:* the instruction drops to `pending_approval` with the on-chain revert reason.
   **This is the money shot.** "If it can't run amok, it's safe."

6. **Human in the tower approves → it settles.**
   The human approves; the payment goes through. Only the verified owner can do this
   (guest sessions are read-only; wallet/magic-link sign-in is verified).
   *Show:* the final settlement + reputation ticking up from a *real* settlement.

---

## ⚠️ Vault choreography note (read before recording)

The vault can show **either** of two things per agent, but not both on the *same* vault:

- **owner ≠ operator separation** — deploy the vault with the human's real wallet as `owner`
  and the server signer as `operator` (the default). Verifiable on arcscan: `owner` and
  `operator` are different addresses. But because the server can't sign as the human `owner`,
  a human-approved override settles by **direct USDC transfer**, not through `ownerPay()`.
- **vault-override money-shot** (steps 5–6) — the human approval settles *through the vault*
  via `ownerPay()`. For the server to sign that, the vault's `owner` must equal the signer
  (`owner == operator`), so this vault does **not** show the address separation.

**So use two agents in the demo:** Agent A to show the on-chain `owner ≠ operator` separation
(name it in the walkthrough, show the two addresses on arcscan); Agent B for the over-limit →
revert → human-override-settles-through-vault money-shot. Don't try to show both on one vault —
the code deliberately falls back to direct settlement in the separated case, and the reason is
honest (the server isn't the human owner). Say that out loud if asked.

---

## Depth reel (spend ~0:30, fast montage — "and it also does…")

Name these; don't dwell. They prove range, not the thesis.

- **x402** — pay-per-call API: 402 → pay USDC on Arc → on-chain verify (replay-protected) → resource.
- **ERC-8183 escrow** — full agent-to-agent job lifecycle (create→fund→submit→complete) settled in USDC.
- **Circle Gateway** — deposit on Arc → move USDC to Base Sepolia **gaslessly** in seconds.
- **Circle Agent Wallet** — a second, hosted enforcement layer that screens transfers.
- **Three independent guarantees** — server pre-check + on-chain vault + Circle screening.

---

## Talking-point guardrails (credibility)

- **Testnet, real tech, test money.** Say it plainly.
- **We say exactly what's true.** KYA = wallet-proof, not audit. Circle *screens*; the
  USD cap is enforced by our server + the vault. This honesty is a feature — lead with it.
- **"Who actually signs the payment?" (have this ready).** *"Today the server signer is the
  vault's delegated `operator`, so it submits `pay()` on the agent's behalf; the human `owner`
  is the user's own wallet. The **limit is trustless either way** — the contract reverts an
  over-limit payment no matter who signs. Handing the `operator` role to an agent-held key /
  Circle programmable wallet, so the agent signs end-to-end, is the next step on the roadmap."*
- **It's live.** `https://a-identity.xyz` (frontend) · `https://a-identity-backend.onrender.com`
  (backend). Live contract reads, verifiable txs, CI + a full E2E.

## One-line closer

> "Every agent gets a passport and a wallet — and a human still holds the leash.
> Verify first, then pay, with real value moving on Arc."
