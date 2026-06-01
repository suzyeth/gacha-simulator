import { useState } from 'react'
import { useSimStore } from './store/sim-store'
import { useActiveConfig } from './store/config-store'
import { useT } from './i18n/store'
import { LangToggle } from './i18n/LangToggle'
import { PoolSummary } from './ui/PoolSummary'
import { SimControls } from './ui/SimControls'
import { DistributionChart } from './ui/DistributionChart'
import { HeadlineDropRate } from './ui/HeadlineDropRate'
import { FormulaComparePanel } from './ui/FormulaComparePanel'
import { EconomyPanel } from './ui/EconomyPanel'
import { TargetSimPanel } from './ui/TargetSimPanel'
import { ConfigSelector } from './ui/ConfigSelector'
import { LootHaulPanel } from './ui/LootHaulPanel'

type Tab = 'pool' | 'sim'

function App() {
  const results = useSimStore((s) => s.results)
  const pool = useActiveConfig()
  const t = useT()
  const [tab, setTab] = useState<Tab>('sim')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{t('app.title')}</h1>
            <p className="text-zinc-400 text-sm mt-1">{t('app.subtitle')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LangToggle />
            <ConfigSelector />
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 -mb-px">
          <TabButton active={tab === 'sim'} onClick={() => setTab('sim')}>
            {t('nav.tab.sim')}
          </TabButton>
          <TabButton active={tab === 'pool'} onClick={() => setTab('pool')}>
            {t('nav.tab.pool')}
          </TabButton>
        </nav>
      </header>

      {tab === 'sim' ? (
        <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Top: 运行控制 + 核心 KPI 横向并列 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SimControls pool={pool} />
            <div className="lg:col-span-2">
              <HeadlineDropRate pool={pool} results={results} />
            </div>
          </div>

          {/* 主视图: 获得物品总结(主角)+ 经济(副角) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LootHaulPanel pool={pool} results={results} />
            </div>
            <div className="space-y-6">
              <EconomyPanel pool={pool} results={results} />
              <FormulaComparePanel results={results} />
            </div>
          </div>

          {/* 目标驱动 + 分布图 — 高级视图 */}
          <TargetSimPanel pool={pool} />
          <DistributionChart pool={pool} results={results} />
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-6">
          <PoolSummary pool={pool} />
        </main>
      )}

      <footer className="max-w-7xl mx-auto px-6 py-4 text-xs text-zinc-600 border-t border-zinc-900 mt-8">
        {t('app.footer')}
      </footer>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-medium border-b-2 transition',
        active
          ? 'border-sky-400 text-sky-200'
          : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:border-zinc-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default App
