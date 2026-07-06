import { useEffect, useState } from 'react'
import {
  checkHealth,
  getArcStatus,
  getChainStatus,
  getReputation,
  resolveAgent,
  type AgentIdentity,
  type ArcStatus,
  type ChainStatus,
  type Reputation,
} from '../lib/mcp-client'

// ── health ───────────────────────────────────────────────────────────────────

export function useMcpHealth() {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const ok = await checkHealth()
      if (!cancelled) setOnline(ok)
    }
    check()
    const id = setInterval(check, 12_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return online
}

// ── resolve agent ─────────────────────────────────────────────────────────────

type AgentState = {
  loading: boolean
  agent: AgentIdentity | null
  source: string | null
  error: string | null
}

export function useResolveAgent(query: string | null) {
  const [state, setState] = useState<AgentState>({
    loading: false,
    agent: null,
    source: null,
    error: null,
  })

  useEffect(() => {
    if (!query) return
    let cancelled = false
    setState({ loading: true, agent: null, source: null, error: null })
    resolveAgent(query).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setState({ loading: false, agent: null, source: null, error: res.error })
        return
      }
      setState({
        loading: false,
        agent: res.data.found ? (res.data.agent ?? null) : null,
        source: res.data.source ?? null,
        error: res.data.found ? null : (res.data as { reason?: string }).reason ?? 'Not found',
      })
    })
    return () => { cancelled = true }
  }, [query])

  return state
}

// ── reputation ────────────────────────────────────────────────────────────────

type RepState = {
  loading: boolean
  reputation: Reputation | null
  error: string | null
}

export function useAgentReputation(agentId: string | null) {
  const [state, setState] = useState<RepState>({ loading: false, reputation: null, error: null })

  useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setState({ loading: true, reputation: null, error: null })
    getReputation(agentId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setState({ loading: false, reputation: null, error: res.error })
        return
      }
      setState({
        loading: false,
        reputation: res.data.found ? (res.data.reputation ?? null) : null,
        error: res.data.found ? null : 'No reputation data',
      })
    })
    return () => { cancelled = true }
  }, [agentId])

  return state
}

// ── chains ────────────────────────────────────────────────────────────────────

type ChainsState = {
  loading: boolean
  chains: ChainStatus[]
  error: string | null
}

export function useMcpChains() {
  const [state, setState] = useState<ChainsState>({ loading: false, chains: [], error: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, chains: [], error: null })
    getChainStatus().then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setState({ loading: false, chains: [], error: res.error })
        return
      }
      setState({ loading: false, chains: res.data.chains, error: null })
    })
    return () => { cancelled = true }
  }, [])

  return state
}

// ── Arc live status ───────────────────────────────────────────────────────────

type ArcState = {
  loading: boolean
  arc: ArcStatus | null
  error: string | null
}

/** Polls live Circle Arc testnet status (chainId, latest block) from the MCP server. */
export function useArcStatus(pollMs = 15_000) {
  const [state, setState] = useState<ArcState>({ loading: true, arc: null, error: null })

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getArcStatus().then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setState({ loading: false, arc: null, error: res.error })
          return
        }
        setState({ loading: false, arc: res.data, error: null })
      })
    load()
    const id = setInterval(load, pollMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  return state
}
