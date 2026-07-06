# Phase 3 - MCP Integration & Network Architecture

> Status: **research + design** (no contracts deployed, no funds moved). Code
> for the layers below is gated behind explicit human approval - see
> "Human-on-the-loop gates".

This document grounds A-Identity's protocol layer in what actually shipped as
of June 2026, and answers the open question from Phase 2: **ARC or 0G?**

---

## TL;DR recommendation

- **ARC (Circle's Arc) is the primary rail** for A-Identity's payment + wallet
  layer. It is a stablecoin-native L1 with a purpose-built **Circle Agent
  Stack** (Agent Wallets, Nanopayments, x402-compatible Agent Marketplace).
  This is exactly A-Identity's "Pay & Wallet" value proposition.
- **0G is a complementary, later-phase data layer** - not a competitor to Arc.
  It is a modular AI L1 for decentralized storage / data-availability / compute,
  useful for persisting agent artifacts and reputation history. **Not needed for
  the MVP.**
- **Identity** = ERC-8004 (live on Ethereum mainnet since 29 Jan 2026).
- **Connectivity** = MCP, with **x402-mcp** to gate paid tools.

So the answer to "which is primary" is **Arc** - and the two are layered, not
mutually exclusive.

---

## Grounded findings

### x402 - the payment handshake
HTTP-native payment standard (Coinbase + the x402 Foundation). An unpaid request
returns `402 Payment Required` with payment terms; the client signs a stablecoin
transfer, attaches proof, and retries. No accounts or API keys by default. As of
June 2026 it had processed **169M+ payments** across ~590k buyers / 100k sellers,
and AWS + Coinbase brought x402 to CloudFront/WAF. Payment-network agnostic but
most flows settle in **USDC**, often on Base.

### ERC-8004 - "Trustless Agents" (identity)
Ethereum standard with three registries: **Identity** (portable agent ID as an
ERC-721 whose tokenURI points to a JSON registration file), **Reputation**
(standardized feedback), and **Validation** (cryptographic/economic verification).
Permissionless - no central issuer. Authored across MetaMask, the Ethereum
Foundation, Google, and Coinbase; an on-chain extension of Google's A2A protocol.
**Live on Ethereum mainnet since 29 Jan 2026.**

### MCP + x402-mcp - connectivity & monetization
Model Context Protocol is the agent and tool standard. **x402-mcp** (Vercel) adds
x402 paywalls to MCP servers via `paidTool`s: agents discover and pay for tools
over HTTP 402, settling in USDC (~100-200ms, fees < $0.01). This is the literal
mechanism for A-Identity's "pay-per-action between agents."

### ARC (Circle) - settlement + wallet rail  ← primary
Permissionless, EVM-compatible L1 from Circle (launched Aug 2025). The **Circle
Agent Stack** (11 May 2026) ships:
- **Agent Wallets** - permissionless, policy-controlled wallets so agents hold
  and move funds within guardrails (this is the wallet abstraction A-Identity
  needs; Privy is an alternative).
- **Nanopayments** (via Circle Gateway) - gas-free USDC transfers as small as
  **$0.000001** at machine speed.
- **Agent Marketplace** - service discovery that **pays for x402-compatible
  services**.
- **Circle CLI** + **Circle Skills**.
Backed by a $222M ARC presale ($3B FDV; a16z, BlackRock, Apollo, et al.).

### 0G (Zero Gravity) - AI data layer  ← optional/later
Modular AI L1: **0G Chain**, **0G Storage**, **0G Compute**, **0G DA**. The DA
layer claims ~**50 GB/s**, "50,000× faster / 100× cheaper" than Ethereum DA.
$290M funded; Aristotle mainnet Sept 2025. Best fit for A-Identity = decentralized
storage of agent metadata, logs, and reputation history - a **Phase 5+** concern.

---

## ARC vs 0G

| Dimension              | **Arc (Circle)** - primary         | **0G (Zero Gravity)** - later        |
| ---------------------- | ---------------------------------- | ------------------------------------ |
| Category               | Stablecoin-native settlement L1    | Modular AI L1 (storage/compute/DA)   |
| Best for A-Identity    | Payments, wallets, settlement      | Verifiable data / reputation history |
| Agent tooling          | Agent Wallets, Nanopayments, CLI, x402-compatible marketplace | AI chain + 50 GB/s DA + storage |
| Native settlement      | USDC                               | 0G token / data fees                 |
| MVP role               | **Required (Pay & Wallet)**        | **Optional (defer)**                 |

**Why Arc first:** A-Identity's whole pitch is *agent identity + payments +
wallet abstraction*. Arc's Agent Stack delivers the wallet + sub-cent settlement
+ x402 compatibility off the shelf, which collapses most of the "Pay" build. 0G
solves a different problem (data) we don't need until reputation/audit history
must be decentralized.

---

## Target architecture

```
            ┌─────────────────────────────────────────────┐
   AI Agent │  MCP client (Claude, AutoGPT, LangChain...)    │
            └───────────────┬─────────────────────────────┘
                            │  MCP (stdio / HTTP)  + x402 handshake
                            ▼
            ┌─────────────────────────────────────────────┐
            │        A-Identity MCP Server (Node/TS)       │
            │  tools:                                      │
            │   • resolve_agent      (read)                │
            │   • get_reputation     (read)                │
            │   • verify_agent       (paid - x402-mcp)     │
            │   • request_payment    (paid - x402-mcp)     │
            │  middleware: KYA verify - reputation update  │
            └───┬───────────────┬───────────────┬──────────┘
                │               │               │
        Verify  ▼        Pay    ▼        Data    ▼ (later)
       ERC-8004 registries   x402 + Circle Arc      0G Storage/DA
       (Ethereum mainnet)    (Agent Wallets,        (agent artifacts,
       identity/reputation   Nanopayments, USDC)    reputation history)
```

### Layer mapping
| A-Identity pillar | Protocol(s)                         | Network            |
| ----------------- | ----------------------------------- | ------------------ |
| Connect           | MCP + x402-mcp                      | HTTP / stdio       |
| Verify (KYA)      | ERC-8004 (identity/reputation/validation) | Ethereum mainnet |
| Pay               | x402 settlement                     | **Arc** (USDC), Base fallback |
| Wallet            | Circle Agent Wallets / Privy        | Arc / Circle Gateway |
| Reputation        | deterministic engine + ERC-8004 feedback | off-chain compute, on-chain anchor |
| Data (later)      | 0G Storage / DA                     | 0G                 |

---

## Phase 3 build plan (incremental, gated)

1. **MCP server scaffold** (`@modelcontextprotocol/sdk`, TypeScript) exposing
   **read-only** tools first: `resolve_agent`, `get_reputation`,
   `list_capabilities`. No keys, no funds. ← safe to build now.
2. **ERC-8004 read adapter** - resolve an agent's ERC-721 identity + registration
   JSON; surface it in the app's Agents page. Read-only RPC.
3. **x402 paid tool (testnet)** - wrap one tool with `x402-mcp` on a testnet
   (e.g. Base Sepolia or an Arc testnet). No mainnet value.
4. **Circle Agent Wallets (sandbox)** - wallet abstraction in Circle's sandbox;
   demonstrate a Nanopayment between two test agents.
5. **Reputation engine** - deterministic scoring over settled (test) actions;
   anchor a hash on-chain later.

### Human-on-the-loop gates
The following **always** require explicit human approval before execution:
- deploying any contract to a mainnet,
- moving real funds / custodying a private key,
- registering a production identity that costs gas.

Everything in steps 1-4 above runs against sandboxes/testnets and is reversible.

---

## Sources

- x402: [Coinbase x402 docs](https://docs.cdp.coinbase.com/x402/welcome) - [AWS + Coinbase bring x402 to CloudFront/WAF](https://genfinity.io/2026/06/16/coinbase-aws-x402-cloudfront-waf-ai-agent-payments/) - [Sherlock explainer](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol)
- ERC-8004: [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004) - [Ethereum Magicians thread](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098) - [QuickNode guide](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/)
- MCP + x402: [Vercel: x402-mcp](https://vercel.com/blog/introducing-x402-mcp-open-protocol-payments-for-mcp-tools) - [MCP & Payments 2026 guide](https://eco.com/support/en/articles/14845480-mcp-and-payments-a-2026-guide)
- Arc (Circle): [Introducing Arc](https://www.circle.com/blog/introducing-arc-an-open-layer-1-blockchain-purpose-built-for-stablecoin-finance) - [Circle Agent Stack](https://www.circle.com/blog/introducing-circle-agent-stack-financial-infrastructure-for-the-agentic-economy) - [Agent Stack docs](https://developers.circle.com/agent-stack) - [CNBC: $222M Arc raise](https://www.cnbc.com/2026/05/11/circle-closes-222-million-from-blackrock-apollo-for-arc-blockchain.html)
- 0G: [0g.ai](https://0g.ai/) - [0G docs: Understanding 0G](https://docs.0g.ai/introduction/understanding-0g) - [0G "Blockchain for AI Agents" release](https://www.globenewswire.com/news-release/2026/03/21/3260008/0/en/0G-Positions-as-the-Blockchain-for-AI-Agents-as-Industry-Moves-Toward-1-Trillion-Agentic-AI-Economy.html)
