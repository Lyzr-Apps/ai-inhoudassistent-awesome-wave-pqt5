'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { callAIAgent, AIAgentResponse } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { FiSearch, FiFileText, FiBarChart2, FiSend, FiSave, FiClock, FiCheck, FiAlertCircle, FiEdit, FiCopy, FiTrendingUp, FiHash, FiLayout, FiSettings, FiChevronRight, FiHome, FiArchive, FiList, FiX, FiLoader } from 'react-icons/fi'

// --- CONSTANTS ---
const AGENT_IDS = {
  contentCoordinator: '699786002b8310cce6585526',
  notionAgent: '69978631ce15805ae8e3267b',
  gmailAgent: '699786302b8310cce6585528',
} as const

const AGENTS_INFO = [
  { id: AGENT_IDS.contentCoordinator, name: 'Content Coordinator', purpose: 'Onderzoekt trends, schrijft artikelen, en optimaliseert SEO' },
  { id: AGENT_IDS.notionAgent, name: 'Notion Publicatie Agent', purpose: 'Slaat artikelen op in Notion' },
  { id: AGENT_IDS.gmailAgent, name: 'Gmail Draft Agent', purpose: 'Maakt email concepten aan in Gmail' },
]

const HISTORY_KEY = 'dutch-content-assistant-history'

// --- TYPES ---
interface TrendingTopic {
  topic: string
  description: string
  relevance: string
  popularity_score: string
}

interface OutlineItem {
  heading: string
  subpoints: string[]
}

interface ContentResult {
  trending_topics?: TrendingTopic[]
  trend_summary?: string
  outline?: OutlineItem[]
  article_title?: string
  article_body?: string
  article_summary?: string
  primary_keywords?: string[]
  secondary_keywords?: string[]
  meta_description?: string
  title_suggestions?: string[]
  seo_score?: string
  search_intent?: string
}

interface HistoryItem {
  id: string
  topic: string
  title: string
  status: 'Concept' | 'Opgeslagen' | 'Verstuurd'
  createdAt: string
  data: ContentResult
}

type ScreenType = 'dashboard' | 'review' | 'geschiedenis' | 'instellingen'

// --- HELPERS ---
function parseAgentResult(result: AIAgentResponse): Record<string, unknown> {
  try {
    const r = result?.response?.result
    if (!r) return {}
    if (typeof r === 'string') {
      try { return JSON.parse(r) } catch { return {} }
    }
    return r as Record<string, unknown>
  } catch { return {} }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Concept': return 'bg-secondary text-secondary-foreground'
    case 'Opgeslagen': return 'bg-primary text-primary-foreground'
    case 'Verstuurd': return 'bg-[hsl(0,80%,45%)] text-white'
    default: return 'bg-secondary text-secondary-foreground'
  }
}

// --- MARKDOWN RENDERER ---
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2" style={{ lineHeight: '1.7' }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-serif font-semibold text-sm mt-3 mb-1 tracking-tight">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-serif font-semibold text-base mt-3 mb-1 tracking-tight">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-serif font-bold text-lg mt-4 mb-2 tracking-tight">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// --- SAMPLE DATA ---
function getSampleData(): ContentResult {
  return {
    trending_topics: [
      { topic: 'AI in de gezondheidszorg', description: 'Artificial Intelligence wordt steeds vaker ingezet in diagnostiek en patientenzorg in Nederlandse ziekenhuizen.', relevance: 'Hoog - direct relevant voor AI-influencers', popularity_score: '92' },
      { topic: 'Generatieve AI wetgeving EU', description: 'De EU AI Act heeft grote gevolgen voor Nederlandse bedrijven die AI-tools ontwikkelen of gebruiken.', relevance: 'Zeer hoog - actueel en urgent', popularity_score: '88' },
      { topic: 'ChatGPT in het onderwijs', description: 'Nederlandse scholen en universiteiten worstelen met beleid rondom AI-gebruik door studenten.', relevance: 'Hoog - brede doelgroep', popularity_score: '85' },
    ],
    trend_summary: 'De Nederlandse AI-markt beweegt zich richting regulering en praktische toepassingen. De EU AI Act domineert het gesprek, terwijl sectoren als gezondheidszorg en onderwijs concrete implementaties doorvoeren.',
    outline: [
      { heading: 'Inleiding: AI in Nederland anno 2025', subpoints: ['Huidige staat van AI-adoptie', 'Waarom dit nu relevant is'] },
      { heading: 'De EU AI Act en wat het betekent', subpoints: ['Kernpunten van de wetgeving', 'Impact op Nederlandse bedrijven', 'Tijdlijn van implementatie'] },
      { heading: 'Praktijkvoorbeelden uit de gezondheidszorg', subpoints: ['Diagnostiek met AI', 'Patientenzorg optimalisatie', 'Ethische overwegingen'] },
      { heading: 'Conclusie en vooruitblik', subpoints: ['Wat we kunnen verwachten', 'Actiepunten voor bedrijven'] },
    ],
    article_title: 'AI in Nederland: Hoe de EU AI Act de Toekomst Vormgeeft',
    article_body: '# AI in Nederland: Hoe de EU AI Act de Toekomst Vormgeeft\n\nDe wereld van kunstmatige intelligentie evolueert razendsnel, en Nederland staat aan de voorhoede van deze transformatie. Met de recente invoering van de EU AI Act staan Nederlandse bedrijven, zorginstellingen en onderwijsorganisaties voor een keerpunt.\n\n## De EU AI Act: Een Nieuw Tijdperk\n\nDe Europese Unie heeft met de AI Act een historisch wetgevingskader gecreeerd dat de ontwikkeling en het gebruik van AI-systemen reguleert. Voor Nederlandse bedrijven betekent dit concrete verplichtingen:\n\n- **Risicoclassificatie**: AI-systemen worden ingedeeld in risicocategorieen\n- **Transparantieverplichtingen**: Gebruikers moeten weten wanneer ze met AI interageren\n- **Conformiteitsbeoordelingen**: Hoog-risico systemen vereisen certificering\n\n## Gezondheidszorg als Voorloper\n\nNederlandse ziekenhuizen lopen voorop in de adoptie van AI-diagnostiek. Het Amsterdam UMC en het Radboudumc gebruiken AI-algoritmen voor:\n\n1. Vroege detectie van kanker via beeldanalyse\n2. Voorspelling van patientuitkomsten\n3. Optimalisatie van behandelplannen\n\n## Conclusie\n\nDe combinatie van **Europese regulering** en **Nederlandse innovatiekracht** creeert een unieke omgeving voor verantwoorde AI-ontwikkeling. Bedrijven die nu investeren in compliance en ethische AI zullen de vruchten plukken.',
    article_summary: 'Een overzicht van hoe de EU AI Act de Nederlandse AI-sector beinvloedt, met praktijkvoorbeelden uit de gezondheidszorg en aanbevelingen voor bedrijven.',
    primary_keywords: ['EU AI Act', 'AI Nederland', 'kunstmatige intelligentie wetgeving'],
    secondary_keywords: ['AI gezondheidszorg', 'AI onderwijs', 'AI regulering Europa', 'Nederlandse AI-bedrijven'],
    meta_description: 'Ontdek hoe de EU AI Act de Nederlandse AI-sector transformeert. Lees over praktijkvoorbeelden uit de gezondheidszorg en wat bedrijven nu moeten doen.',
    title_suggestions: [
      'AI in Nederland: Hoe de EU AI Act de Toekomst Vormgeeft',
      'De Impact van de EU AI Act op Nederlandse Bedrijven',
      'Van Regulering tot Innovatie: AI in Nederland 2025',
    ],
    seo_score: '87/100',
    search_intent: 'Informational - gebruikers zoeken informatie over AI-wetgeving en de impact op Nederlandse organisaties',
  }
}

function getSampleHistory(): HistoryItem[] {
  return [
    {
      id: 'sample1',
      topic: 'AI in de gezondheidszorg',
      title: 'AI in Nederland: Hoe de EU AI Act de Toekomst Vormgeeft',
      status: 'Opgeslagen',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      data: getSampleData(),
    },
    {
      id: 'sample2',
      topic: 'Machine Learning trends',
      title: 'Machine Learning in 2025: De Belangrijkste Ontwikkelingen',
      status: 'Verstuurd',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      data: getSampleData(),
    },
    {
      id: 'sample3',
      topic: 'Chatbots voor klantenservice',
      title: 'Chatbots Revolutioneren de Nederlandse Klantenservice',
      status: 'Concept',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      data: getSampleData(),
    },
  ]
}

// --- ERROR BOUNDARY ---
class InlineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Er ging iets mis</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground text-sm">
              Opnieuw proberen
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- SIDEBAR ---
function Sidebar({ currentScreen, onNavigate }: { currentScreen: ScreenType; onNavigate: (s: ScreenType) => void }) {
  const navItems: { screen: ScreenType; label: string; icon: React.ReactNode }[] = [
    { screen: 'dashboard', label: 'Dashboard', icon: <FiHome className="w-4 h-4" /> },
    { screen: 'geschiedenis', label: 'Geschiedenis', icon: <FiArchive className="w-4 h-4" /> },
    { screen: 'instellingen', label: 'Instellingen', icon: <FiSettings className="w-4 h-4" /> },
  ]

  return (
    <div className="w-60 border-r border-border bg-[hsl(var(--sidebar-background))] flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6 border-b border-border">
        <h1 className="font-serif text-xl font-bold tracking-tight">Content Assistant</h1>
        <p className="text-xs text-muted-foreground mt-1">AI Content voor Nederlandse Creators</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.screen}
            onClick={() => onNavigate(item.screen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${currentScreen === item.screen ? 'bg-[hsl(var(--sidebar-accent))] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--sidebar-accent))]'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Agents</p>
        <div className="space-y-2">
          {AGENTS_INFO.map((agent) => (
            <div key={agent.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- LOADING SKELETON ---
function ContentSkeleton({ message }: { message: string }) {
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-3 text-muted-foreground">
        <FiLoader className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="space-y-4">
        <div className="animate-pulse bg-muted h-6 w-3/4" />
        <div className="animate-pulse bg-muted h-4 w-full" />
        <div className="animate-pulse bg-muted h-4 w-5/6" />
        <div className="animate-pulse bg-muted h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="animate-pulse bg-muted h-32" />
        <div className="animate-pulse bg-muted h-32" />
      </div>
      <div className="space-y-3">
        <div className="animate-pulse bg-muted h-4 w-full" />
        <div className="animate-pulse bg-muted h-4 w-4/5" />
        <div className="animate-pulse bg-muted h-4 w-3/4" />
      </div>
    </div>
  )
}

// --- TRENDING TOPICS TAB ---
function TrendingTopicsTab({ data }: { data: ContentResult }) {
  const topics = Array.isArray(data?.trending_topics) ? data.trending_topics : []
  const summary = data?.trend_summary ?? ''

  return (
    <div className="space-y-6">
      {summary && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base tracking-tight flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4" />
              Trend Samenvatting
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderMarkdown(summary)}
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        <h3 className="font-serif text-base font-semibold tracking-tight">Trending Onderwerpen</h3>
        {topics.length === 0 && (
          <p className="text-sm text-muted-foreground">Geen trending topics gevonden.</p>
        )}
        {topics.map((topic, idx) => (
          <Card key={idx} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <h4 className="font-serif font-semibold text-sm tracking-tight">{topic?.topic ?? 'Onbekend'}</h4>
                  <p className="text-sm text-muted-foreground" style={{ lineHeight: '1.7' }}>{topic?.description ?? ''}</p>
                  <p className="text-xs text-muted-foreground">{topic?.relevance ?? ''}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  {topic?.popularity_score ?? '-'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// --- OUTLINE TAB ---
function OutlineTab({ data, onUpdate }: { data: ContentResult; onUpdate: (outline: OutlineItem[]) => void }) {
  const outline = Array.isArray(data?.outline) ? data.outline : []

  const handleHeadingChange = (idx: number, value: string) => {
    const updated = [...outline]
    updated[idx] = { ...updated[idx], heading: value }
    onUpdate(updated)
  }

  const handleSubpointChange = (outlineIdx: number, subIdx: number, value: string) => {
    const updated = [...outline]
    const currentSubpoints = Array.isArray(updated[outlineIdx]?.subpoints) ? [...updated[outlineIdx].subpoints] : []
    currentSubpoints[subIdx] = value
    updated[outlineIdx] = { ...updated[outlineIdx], subpoints: currentSubpoints }
    onUpdate(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold tracking-tight">Artikelstructuur</h3>
        <Badge variant="outline" className="text-xs font-mono">{outline.length} secties</Badge>
      </div>
      {outline.length === 0 && (
        <p className="text-sm text-muted-foreground">Geen outline beschikbaar.</p>
      )}
      {outline.map((section, idx) => (
        <Card key={idx} className="border border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</span>
              <Input
                value={section?.heading ?? ''}
                onChange={(e) => handleHeadingChange(idx, e.target.value)}
                className="font-serif font-semibold text-sm border-0 border-b border-border bg-transparent px-0 focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>
            <div className="ml-8 space-y-2">
              {Array.isArray(section?.subpoints) && section.subpoints.map((sub, subIdx) => (
                <div key={subIdx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    value={sub ?? ''}
                    onChange={(e) => handleSubpointChange(idx, subIdx, e.target.value)}
                    className="text-sm border-0 border-b border-border/50 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-foreground"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// --- ARTICLE TAB ---
function ArticleTab({ data, onTitleChange, onBodyChange, onSummaryChange }: {
  data: ContentResult
  onTitleChange: (val: string) => void
  onBodyChange: (val: string) => void
  onSummaryChange: (val: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = `${data?.article_title ?? ''}\n\n${data?.article_body ?? ''}`
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold tracking-tight">Artikel</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs gap-1.5">
            {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
            {copied ? 'Gekopieerd' : 'Kopieer'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} className="text-xs gap-1.5">
            <FiEdit className="w-3.5 h-3.5" />
            {isEditing ? 'Voorbeeld' : 'Bewerken'}
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Titel</Label>
        <Input
          value={data?.article_title ?? ''}
          onChange={(e) => onTitleChange(e.target.value)}
          className="font-serif text-lg font-bold tracking-tight border-border"
        />
      </div>

      {isEditing ? (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Artikeltekst</Label>
          <Textarea
            value={data?.article_body ?? ''}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={20}
            className="font-sans text-sm border-border"
            style={{ lineHeight: '1.7' }}
          />
        </div>
      ) : (
        <Card className="border border-border">
          <CardContent className="p-6">
            <ScrollArea className="max-h-[500px]">
              {renderMarkdown(data?.article_body ?? '')}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Samenvatting</Label>
        <Textarea
          value={data?.article_summary ?? ''}
          onChange={(e) => onSummaryChange(e.target.value)}
          rows={3}
          className="text-sm border-border"
          style={{ lineHeight: '1.7' }}
        />
      </div>
    </div>
  )
}

// --- SEO TAB ---
function SEOTab({ data }: { data: ContentResult }) {
  const primaryKw = Array.isArray(data?.primary_keywords) ? data.primary_keywords : []
  const secondaryKw = Array.isArray(data?.secondary_keywords) ? data.secondary_keywords : []
  const titleSuggestions = Array.isArray(data?.title_suggestions) ? data.title_suggestions : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold tracking-tight">SEO Analyse</h3>
        {data?.seo_score && (
          <Badge variant="outline" className="font-mono text-sm px-3 py-1">
            Score: {data.seo_score}
          </Badge>
        )}
      </div>

      {data?.search_intent && (
        <Card className="border border-border">
          <CardContent className="p-4">
            <Label className="text-xs text-muted-foreground mb-1 block">Zoekintentie</Label>
            <p className="text-sm" style={{ lineHeight: '1.7' }}>{data.search_intent}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FiHash className="w-3.5 h-3.5" />
              Primaire Zoekwoorden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {primaryKw.length === 0 && <span className="text-xs text-muted-foreground">Geen zoekwoorden</span>}
              {primaryKw.map((kw, idx) => (
                <Badge key={idx} variant="default" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FiHash className="w-3.5 h-3.5" />
              Secundaire Zoekwoorden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {secondaryKw.length === 0 && <span className="text-xs text-muted-foreground">Geen zoekwoorden</span>}
              {secondaryKw.map((kw, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.meta_description && (
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Meta-beschrijving</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" style={{ lineHeight: '1.7' }}>{data.meta_description}</p>
            <p className="text-xs text-muted-foreground mt-2 font-mono">{(data.meta_description ?? '').length} tekens</p>
          </CardContent>
        </Card>
      )}

      {titleSuggestions.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Titelsuggesties</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {titleSuggestions.map((title, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{idx + 1}.</span>
                  <span style={{ lineHeight: '1.7' }}>{title}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- AGENT STATUS ---
function AgentStatusPanel({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {AGENTS_INFO.map((agent) => (
          <div key={agent.id} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${activeAgentId === agent.id ? 'bg-[hsl(120,60%,40%)] animate-pulse' : 'bg-border'}`} />
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${activeAgentId === agent.id ? 'text-foreground' : 'text-muted-foreground'}`}>{agent.name}</p>
              <p className="text-xs text-muted-foreground truncate">{agent.purpose}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// --- MAIN PAGE ---
export default function Page() {
  // Navigation
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard')

  // Content generation
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [contentData, setContentData] = useState<ContentResult | null>(null)
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Active agent tracking
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Notion agent
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionStatus, setNotionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Gmail agent
  const [gmailDialogOpen, setGmailDialogOpen] = useState(false)
  const [gmailForm, setGmailForm] = useState({ recipient: '', subject: '', message: '' })
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyFilter, setHistoryFilter] = useState<string>('Alle')
  const [historySearch, setHistorySearch] = useState('')

  // Sample data toggle
  const [showSampleData, setShowSampleData] = useState(false)

  // Review tab state
  const [activeTab, setActiveTab] = useState('trending')

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Save history to localStorage
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }, [])

  // We need a ref for history to avoid stale closures
  const historyRef = useRef(history)
  useEffect(() => {
    historyRef.current = history
  }, [history])

  // Generate content
  const handleGenerate = useCallback(async (inputTopic: string) => {
    if (!inputTopic.trim()) return
    setIsGenerating(true)
    setErrorMsg('')
    setContentData(null)
    setActiveTab('trending')
    setCurrentScreen('review')
    setNotionStatus(null)
    setGmailStatus(null)

    const loadingMessages = [
      'Onderwerpen worden onderzocht...',
      'Trends worden geanalyseerd...',
      'Artikel wordt geschreven...',
      'SEO-optimalisatie wordt uitgevoerd...',
      'Content wordt samengesteld...',
    ]

    let msgIdx = 0
    setLoadingMessage(loadingMessages[0])
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[msgIdx])
    }, 4000)

    setActiveAgentId(AGENT_IDS.contentCoordinator)

    try {
      const result = await callAIAgent(
        `Genereer uitgebreide content over het volgende onderwerp: ${inputTopic}. Geef trending topics, een artikel met outline, en SEO-analyse. Schrijf alles in het Nederlands.`,
        AGENT_IDS.contentCoordinator
      )

      clearInterval(interval)
      setActiveAgentId(null)

      if (result?.success) {
        const parsed = parseAgentResult(result) as ContentResult
        setContentData(parsed)

        const newItem: HistoryItem = {
          id: generateId(),
          topic: inputTopic,
          title: parsed?.article_title ?? inputTopic,
          status: 'Concept',
          createdAt: new Date().toISOString(),
          data: parsed,
        }
        setCurrentHistoryId(newItem.id)
        saveHistory([newItem, ...historyRef.current])
      } else {
        setErrorMsg(result?.error ?? result?.response?.message ?? 'Er is een fout opgetreden bij het genereren van content.')
      }
    } catch {
      clearInterval(interval)
      setActiveAgentId(null)
      setErrorMsg('Er is een onverwachte fout opgetreden. Probeer het opnieuw.')
    }

    setIsGenerating(false)
    setLoadingMessage('')
  }, [saveHistory])

  // Save to Notion
  const handleSaveNotion = useCallback(async () => {
    if (!contentData) return
    setNotionLoading(true)
    setNotionStatus(null)
    setActiveAgentId(AGENT_IDS.notionAgent)

    const outlineText = Array.isArray(contentData.outline)
      ? contentData.outline.map((s) => `${s?.heading ?? ''}\n${Array.isArray(s?.subpoints) ? s.subpoints.map((sp) => `  - ${sp}`).join('\n') : ''}`).join('\n\n')
      : ''

    const keywords = [
      ...(Array.isArray(contentData.primary_keywords) ? contentData.primary_keywords : []),
      ...(Array.isArray(contentData.secondary_keywords) ? contentData.secondary_keywords : []),
    ].join(', ')

    const message = `Sla dit artikel op in Notion met de titel "${contentData.article_title ?? 'Untitled'}".

Artikel inhoud:
${contentData.article_body ?? ''}

Samenvatting:
${contentData.article_summary ?? ''}

Outline:
${outlineText}

Zoekwoorden: ${keywords}
Meta-beschrijving: ${contentData.meta_description ?? ''}`

    try {
      const result = await callAIAgent(message, AGENT_IDS.notionAgent)
      setActiveAgentId(null)

      if (result?.success) {
        const parsed = parseAgentResult(result)
        const notionUrl = parsed?.notion_page_url as string | undefined
        const statusMsg = parsed?.message as string | undefined
        setNotionStatus({
          type: 'success',
          message: `${statusMsg ?? 'Artikel succesvol opgeslagen in Notion.'}${notionUrl ? ` URL: ${notionUrl}` : ''}`,
        })

        if (currentHistoryId) {
          const updatedHistory = historyRef.current.map((item) =>
            item.id === currentHistoryId
              ? { ...item, status: 'Opgeslagen' as const, data: contentData }
              : item
          )
          saveHistory(updatedHistory)
        }
      } else {
        setNotionStatus({ type: 'error', message: result?.error ?? 'Fout bij opslaan in Notion.' })
      }
    } catch {
      setActiveAgentId(null)
      setNotionStatus({ type: 'error', message: 'Onverwachte fout bij opslaan in Notion.' })
    }

    setNotionLoading(false)
  }, [contentData, currentHistoryId, saveHistory])

  // Create Gmail draft
  const handleGmailDraft = useCallback(async () => {
    if (!contentData || !gmailForm.recipient.trim() || !gmailForm.subject.trim()) return
    setGmailLoading(true)
    setGmailStatus(null)
    setActiveAgentId(AGENT_IDS.gmailAgent)

    const message = `Maak een email draft aan met de volgende gegevens:
Ontvanger: ${gmailForm.recipient}
Onderwerp: ${gmailForm.subject}
${gmailForm.message ? `Bericht: ${gmailForm.message}` : ''}

Artikel titel: ${contentData.article_title ?? ''}

Artikel samenvatting:
${contentData.article_summary ?? ''}

Zoekwoorden: ${Array.isArray(contentData.primary_keywords) ? contentData.primary_keywords.join(', ') : ''}`

    try {
      const result = await callAIAgent(message, AGENT_IDS.gmailAgent)
      setActiveAgentId(null)

      if (result?.success) {
        const parsed = parseAgentResult(result)
        const statusMsg = parsed?.message as string | undefined
        setGmailStatus({ type: 'success', message: statusMsg ?? 'Email concept succesvol aangemaakt in Gmail.' })

        if (currentHistoryId) {
          const updatedHistory = historyRef.current.map((item) =>
            item.id === currentHistoryId
              ? { ...item, status: 'Verstuurd' as const }
              : item
          )
          saveHistory(updatedHistory)
        }

        setGmailForm({ recipient: '', subject: '', message: '' })
        setTimeout(() => setGmailDialogOpen(false), 2500)
      } else {
        setGmailStatus({ type: 'error', message: result?.error ?? 'Fout bij aanmaken email concept.' })
      }
    } catch {
      setActiveAgentId(null)
      setGmailStatus({ type: 'error', message: 'Onverwachte fout bij aanmaken email concept.' })
    }

    setGmailLoading(false)
  }, [contentData, gmailForm, currentHistoryId, saveHistory])

  // Open history item
  const openHistoryItem = useCallback((item: HistoryItem) => {
    setContentData(item.data)
    setCurrentHistoryId(item.id)
    setActiveTab('trending')
    setNotionStatus(null)
    setGmailStatus(null)
    setErrorMsg('')
    setCurrentScreen('review')
  }, [])

  // Update content data helper
  const updateContentData = useCallback((updates: Partial<ContentResult>) => {
    setContentData((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      // Also update history
      if (currentHistoryId) {
        const updatedHistory = historyRef.current.map((item) =>
          item.id === currentHistoryId
            ? { ...item, data: updated, title: updates.article_title ?? item.title }
            : item
        )
        saveHistory(updatedHistory)
      }
      return updated
    })
  }, [currentHistoryId, saveHistory])

  // Filter history
  const displayHistory = showSampleData && history.length === 0 ? getSampleHistory() : history
  const filteredHistory = displayHistory.filter((item) => {
    const matchesFilter = historyFilter === 'Alle' || item.status === historyFilter
    const matchesSearch = !historySearch.trim() ||
      (item.title ?? '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (item.topic ?? '').toLowerCase().includes(historySearch.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Display data for current view
  const displayData = showSampleData && !contentData ? getSampleData() : contentData

  // --- RENDER DASHBOARD ---
  function renderDashboard() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-serif text-xl tracking-tight">Nieuwe Content</CardTitle>
              <CardDescription style={{ lineHeight: '1.7' }}>
                Voer een onderwerp of niche in en laat AI een compleet contentpakket genereren met trending topics, artikelen en SEO-optimalisatie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic-input" className="text-sm font-medium mb-1.5 block">Onderwerp of Niche</Label>
                <Input
                  id="topic-input"
                  placeholder="Bijv. AI in de gezondheidszorg, duurzame technologie..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(topic) }}
                  className="border-border"
                />
              </div>
              <Button
                onClick={() => handleGenerate(topic)}
                disabled={!topic.trim() || isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Bezig met genereren...
                  </>
                ) : (
                  <>
                    <FiFileText className="w-4 h-4" />
                    Genereer Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {errorMsg && (
            <Card className="border border-[hsl(0,80%,45%)]">
              <CardContent className="p-4 flex items-start gap-3">
                <FiAlertCircle className="w-4 h-4 text-[hsl(0,80%,45%)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[hsl(0,80%,45%)]">Fout</p>
                  <p className="text-sm text-muted-foreground">{errorMsg}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <AgentStatusPanel activeAgentId={activeAgentId} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold tracking-tight">Recente Content</h2>
            {displayHistory.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setCurrentScreen('geschiedenis')}>
                Alles bekijken <FiChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>

          {displayHistory.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="p-8 text-center">
                <FiFileText className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Nog geen content</p>
                <p className="text-xs text-muted-foreground" style={{ lineHeight: '1.7' }}>
                  Genereer je eerste content door een onderwerp in te voeren en op de knop &quot;Genereer Content&quot; te klikken.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {['Alle', 'Concept', 'Opgeslagen', 'Verstuurd'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${historyFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2 pr-2">
                  {filteredHistory.slice(0, 5).map((item) => (
                    <Card
                      key={item.id}
                      className="border border-border cursor-pointer transition-colors hover:bg-secondary/50"
                      onClick={() => openHistoryItem(item)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold font-serif tracking-tight truncate">{item.title ?? item.topic}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <FiClock className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                            </div>
                          </div>
                          <Badge className={`shrink-0 text-xs ${getStatusColor(item.status)}`}>
                            {item.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- RENDER REVIEW ---
  function renderReview() {
    if (isGenerating) {
      return <ContentSkeleton message={loadingMessage} />
    }

    if (!displayData) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <FiFileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-serif text-lg font-semibold tracking-tight mb-2">Geen content beschikbaar</h3>
          <p className="text-sm text-muted-foreground mb-4">Genereer eerst content op het dashboard.</p>
          <Button onClick={() => setCurrentScreen('dashboard')} variant="outline" className="gap-2">
            <FiHome className="w-4 h-4" />
            Naar Dashboard
          </Button>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-secondary">
              <TabsTrigger value="trending" className="gap-1.5 text-xs">
                <FiTrendingUp className="w-3.5 h-3.5" />
                Trending Topics
              </TabsTrigger>
              <TabsTrigger value="outline" className="gap-1.5 text-xs">
                <FiList className="w-3.5 h-3.5" />
                Outline
              </TabsTrigger>
              <TabsTrigger value="artikel" className="gap-1.5 text-xs">
                <FiFileText className="w-3.5 h-3.5" />
                Artikel
              </TabsTrigger>
              <TabsTrigger value="seo" className="gap-1.5 text-xs">
                <FiBarChart2 className="w-3.5 h-3.5" />
                SEO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trending">
              <TrendingTopicsTab data={displayData} />
            </TabsContent>

            <TabsContent value="outline">
              <OutlineTab
                data={displayData}
                onUpdate={(outline) => updateContentData({ outline })}
              />
            </TabsContent>

            <TabsContent value="artikel">
              <ArticleTab
                data={displayData}
                onTitleChange={(v) => updateContentData({ article_title: v })}
                onBodyChange={(v) => updateContentData({ article_body: v })}
                onSummaryChange={(v) => updateContentData({ article_summary: v })}
              />
            </TabsContent>

            <TabsContent value="seo">
              <SEOTab data={displayData} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="xl:col-span-1 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentScreen('dashboard')} className="text-xs gap-1.5 mb-2 text-muted-foreground">
            <FiHome className="w-3.5 h-3.5" />
            Terug naar Dashboard
          </Button>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiSave className="w-4 h-4" />
                Opslaan in Notion
              </CardTitle>
              <CardDescription className="text-xs">
                Sla het artikel en alle gegevens op in je Notion workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSaveNotion}
                disabled={notionLoading || !contentData}
                className="w-full gap-2"
                variant="outline"
              >
                {notionLoading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    Opslaan in Notion
                  </>
                )}
              </Button>
              {notionStatus && (
                <div className={`mt-3 p-2.5 text-xs flex items-start gap-2 ${notionStatus.type === 'success' ? 'bg-secondary text-foreground' : 'bg-[hsl(0,80%,95%)] text-[hsl(0,80%,45%)]'}`}>
                  {notionStatus.type === 'success' ? <FiCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  <span style={{ lineHeight: '1.5' }}>{notionStatus.message}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiSend className="w-4 h-4" />
                Email Draft
              </CardTitle>
              <CardDescription className="text-xs">
                Maak een email concept aan in Gmail met de samenvatting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={gmailDialogOpen} onOpenChange={(open) => {
                setGmailDialogOpen(open)
                if (!open) setGmailStatus(null)
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={!contentData}
                  >
                    <FiSend className="w-4 h-4" />
                    Maak Email Draft
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif tracking-tight">Email Concept Aanmaken</DialogTitle>
                    <DialogDescription>
                      Vul de gegevens in om een email concept aan te maken in Gmail.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="gmail-recipient" className="text-sm font-medium">
                        Ontvanger *
                      </Label>
                      <Input
                        id="gmail-recipient"
                        type="email"
                        placeholder="email@voorbeeld.nl"
                        value={gmailForm.recipient}
                        onChange={(e) => setGmailForm((prev) => ({ ...prev, recipient: e.target.value }))}
                        className="mt-1.5 border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gmail-subject" className="text-sm font-medium">
                        Onderwerp *
                      </Label>
                      <Input
                        id="gmail-subject"
                        placeholder="Nieuw artikel: ..."
                        value={gmailForm.subject}
                        onChange={(e) => setGmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                        className="mt-1.5 border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gmail-message" className="text-sm font-medium">
                        Extra bericht (optioneel)
                      </Label>
                      <Textarea
                        id="gmail-message"
                        placeholder="Voeg een persoonlijk bericht toe..."
                        value={gmailForm.message}
                        onChange={(e) => setGmailForm((prev) => ({ ...prev, message: e.target.value }))}
                        rows={3}
                        className="mt-1.5 border-border"
                      />
                    </div>

                    {gmailStatus && (
                      <div className={`p-2.5 text-xs flex items-start gap-2 ${gmailStatus.type === 'success' ? 'bg-secondary text-foreground' : 'bg-[hsl(0,80%,95%)] text-[hsl(0,80%,45%)]'}`}>
                        {gmailStatus.type === 'success' ? <FiCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                        <span style={{ lineHeight: '1.5' }}>{gmailStatus.message}</span>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setGmailDialogOpen(false)} disabled={gmailLoading}>
                      Annuleren
                    </Button>
                    <Button
                      onClick={handleGmailDraft}
                      disabled={gmailLoading || !gmailForm.recipient.trim() || !gmailForm.subject.trim()}
                      className="gap-2"
                    >
                      {gmailLoading ? (
                        <>
                          <FiLoader className="w-4 h-4 animate-spin" />
                          Aanmaken...
                        </>
                      ) : (
                        <>
                          <FiSend className="w-4 h-4" />
                          Concept Aanmaken
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <AgentStatusPanel activeAgentId={activeAgentId} />
        </div>
      </div>
    )
  }

  // --- RENDER GESCHIEDENIS ---
  function renderGeschiedenis() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">Geschiedenis</h2>
          <p className="text-sm text-muted-foreground mt-1" style={{ lineHeight: '1.7' }}>
            Bekijk en beheer al je eerder gegenereerde content.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op titel of onderwerp..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-9 border-border"
            />
          </div>
          <div className="flex gap-2">
            {['Alle', 'Concept', 'Opgeslagen', 'Verstuurd'].map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${historyFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <Card className="border border-border">
            <CardContent className="p-12 text-center">
              <FiArchive className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-serif text-lg font-semibold tracking-tight mb-2">Geen resultaten</h3>
              <p className="text-sm text-muted-foreground">
                {displayHistory.length === 0
                  ? 'Je hebt nog geen content gegenereerd. Ga naar het dashboard om te beginnen.'
                  : 'Geen items gevonden met deze zoekcriteria.'}
              </p>
              {displayHistory.length === 0 && (
                <Button onClick={() => setCurrentScreen('dashboard')} variant="outline" className="mt-4 gap-2">
                  <FiHome className="w-4 h-4" />
                  Naar Dashboard
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <Card
                key={item.id}
                className="border border-border cursor-pointer transition-colors hover:bg-secondary/50"
                onClick={() => openHistoryItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif font-semibold tracking-tight truncate">{item.title ?? item.topic}</h3>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <FiClock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FiLayout className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{item.topic}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                        {item.status}
                      </Badge>
                      <FiChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // --- RENDER INSTELLINGEN ---
  function renderInstellingen() {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">Instellingen</h2>
          <p className="text-sm text-muted-foreground mt-1" style={{ lineHeight: '1.7' }}>
            Beheer je voorkeuren en bekijk systeeminformatie.
          </p>
        </div>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">AI Agents</CardTitle>
            <CardDescription className="text-xs">
              Overzicht van de AI-agents die je content genereren en beheren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {AGENTS_INFO.map((agent) => (
              <div key={agent.id} className="flex items-start gap-3 p-3 bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-[hsl(120,60%,40%)] mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{agent.name}</p>
                  <p className="text-xs text-muted-foreground" style={{ lineHeight: '1.7' }}>{agent.purpose}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">ID: {agent.id}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Gegevens</CardTitle>
            <CardDescription className="text-xs">
              Beheer je lokaal opgeslagen content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Opgeslagen items</p>
                <p className="text-xs text-muted-foreground">{history.length} content items in lokale opslag</p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">{history.length}</Badge>
            </div>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                if (typeof window !== 'undefined' && window.confirm('Weet je zeker dat je alle geschiedenis wilt wissen?')) {
                  saveHistory([])
                }
              }}
            >
              <FiX className="w-3.5 h-3.5" />
              Geschiedenis wissen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Screen titles
  const screenTitles: Record<ScreenType, string> = {
    dashboard: 'Dashboard',
    review: 'Content Review',
    geschiedenis: 'Geschiedenis',
    instellingen: 'Instellingen',
  }

  return (
    <InlineErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="border-b border-border bg-card px-8 py-4 flex items-center justify-between shrink-0">
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight">{screenTitles[currentScreen]}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Voorbeelddata
              </Label>
              <Switch
                id="sample-toggle"
                checked={showSampleData}
                onCheckedChange={setShowSampleData}
              />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-8">
              {currentScreen === 'dashboard' && renderDashboard()}
              {currentScreen === 'review' && renderReview()}
              {currentScreen === 'geschiedenis' && renderGeschiedenis()}
              {currentScreen === 'instellingen' && renderInstellingen()}
            </div>
          </main>
        </div>
      </div>
    </InlineErrorBoundary>
  )
}
