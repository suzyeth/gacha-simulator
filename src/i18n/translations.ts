export type Lang = 'en' | 'zh'

/**
 * Bilingual UI dictionary. Keys are dot-namespaced by component.
 * Use {placeholder} syntax for interpolation; t(key, { name: 'x' }) replaces.
 *
 * When adding new keys: add BOTH languages. TypeScript will warn if a key
 * is missing from one language (via the type constraint at the bottom).
 */
const en = {
  // App shell
  'app.title': 'Gacha Simulator',
  'app.subtitle': "Designer's decision tool · Multi-scheme management",
  'app.footer':
    'Engine: plugin-rule architecture · A1 cyclic-pity · 200k MC ±0.4% vs theory · localStorage persisted',

  // Language toggle
  'lang.toggle.title': 'Switch language',

  // ConfigSelector
  'config.default_suffix': '(default)',
  'config.rename': 'Rename',
  'config.duplicate': 'Duplicate',
  'config.export': 'Export',
  'config.import_json': 'Import JSON',
  'config.import_xlsx': 'Import xlsx',
  'config.import_xlsx_running': 'Parsing…',
  'config.delete': 'Delete',
  'config.reset_default': 'Reset default',
  'config.tip.rename': 'Rename current scheme',
  'config.tip.duplicate': 'Clone current as a new scheme and switch',
  'config.tip.export': 'Download current scheme as JSON',
  'config.tip.import_json': 'Import scheme from JSON file',
  'config.tip.import_xlsx': 'Import multiple xlsx tables (auto-detect R03/R05 layout)',
  'config.tip.delete_default': 'Default scheme cannot be deleted',
  'config.tip.delete': 'Delete current scheme',
  'config.tip.reset_default': 'Restore default scheme to original',
  'config.tip.dropdown': 'Current scheme ID: {id}',
  'config.msg.switched': 'Switched to "{name}"',
  'config.msg.duplicated': 'Duplicated as new scheme',
  'config.msg.deleted': 'Deleted "{name}"',
  'config.msg.exported': 'Downloaded JSON',
  'config.msg.import_failed': 'Import failed: {msg}',
  'config.msg.imported_with_warnings': 'Imported with {n} warnings (see console)',
  'config.msg.imported': 'Imported & switched',
  'config.msg.parse_failed': 'JSON parse failed: {msg}',
  'config.msg.xlsx_failed': 'xlsx import failed: {msg}',
  'config.msg.xlsx_imported_warn': 'Imported ({s}), {n} warnings (see console)',
  'config.msg.xlsx_imported': 'Imported & switched ({s})',
  'config.msg.reset_ok': 'Default scheme restored',
  'config.confirm.delete': 'Delete scheme "{name}"?',
  'config.confirm.reset': 'Restore default scheme to original? Your edits to the default will be lost.',

  // PoolSummary
  'pool.col.bucket': 'Bucket',
  'pool.col.name': 'Name',
  'pool.col.weight': 'Weight',
  'pool.col.base_prob': 'Base prob',
  'pool.col.items': 'Items',
  'pool.add_bucket': '+ Add bucket',
  'pool.rules.header': 'Rules',
  'pool.rules.empty': 'No rules (pure random pool)',
  'pool.rules.add_cyclic': '+ Add cyclic pity',
  'pool.rules.cyclic_label': 'cyclic-pity · every',
  'pool.rules.cyclic_force': 'pulls force',
  'pool.rules.script_label': 'first {n} pulls scripted',
  'pool.contents.header': '"{name}" contents (in-box weights / items)',
  'pool.contents.add_item': '+ Add item',
  'pool.contents.col.resId': 'resId',
  'pool.contents.col.name': 'Name',
  'pool.contents.col.weight': 'Weight',
  'pool.contents.col.percent': 'In-box %',
  'pool.contents.help':
    'Edit weight = others stay same, all % auto-renormalize | Edit % = engine reverse-derives this item\'s weight (others keep absolute weight, their % shifts)',
  'pool.tooltip.bucket_weight': 'Click to edit first-level weight',
  'pool.tooltip.expand': 'Expand to edit contents',
  'pool.tooltip.collapse': 'Collapse contents',
  'pool.tooltip.delete_bucket': 'Delete this bucket',
  'pool.tooltip.edit_weight': 'Click to edit weight',
  'pool.tooltip.edit_percent':
    "Click to edit this item's probability inside the bucket (engine reverse-derives weight; other items' absolute weights stay)",
  'pool.tooltip.delete_item': 'Delete this item',
  'pool.tooltip.delete_rule': 'Delete this rule',
  'pool.tooltip.tip_edit': 'Click to edit',
  'pool.confirm.last_bucket': 'Must keep at least 1 bucket',
  'pool.confirm.last_item': 'Each bucket must keep at least 1 item',
  'pool.confirm.delete_bucket':
    'Delete bucket "{id}"? All contents in this bucket will be deleted too.',
  'pool.confirm.delete_rule': 'Delete this rule?',
  'pool.percent.invalid': 'Probability must be strictly between 0% and 100%',
  'pool.percent.single_item': 'Bucket has only one item; cannot set probability independently',

  // SimControls
  'sim.title': 'Simulator',
  'sim.total': 'Total {n} pulls',
  'sim.btn.1': '1 pull',
  'sim.btn.10': '10-pull',
  'sim.btn.100': '100 pulls',
  'sim.btn.100k': '100k MC',
  'sim.running': 'Running…',
  'sim.reset': 'Reset (re-init pity counters)',
  'sim.help': 'Cumulative across clicks — pity counter persists',
  'sim.last_elapsed': 'Last: {n}ms',
  'sim.error': 'Sim failed',

  // TargetSimPanel
  'target.title': '🎯 Target-driven sim (percentiles)',
  'target.field.target': 'Target item',
  'target.field.trials': 'Trials (players)',
  'target.field.max_pulls': 'Max pulls / player',
  'target.field.cost': '¥/pull',
  'target.btn.run': 'Run {n} players until "{name}"',
  'target.btn.running': 'Running…',
  'target.failure_warn':
    '⚠ {pct}% of players did NOT acquire within {n} pulls (capped; real cost is higher)',
  'target.col.percentile': 'Percentile',
  'target.col.pulls': 'Pulls',
  'target.col.cost': '¥ Cost',
  'target.col.meaning': 'Meaning',
  'target.p50.meaning': 'Median player',
  'target.p75.meaning': 'Top 25% pay more',
  'target.p90.meaning': 'Unlucky 10% threshold',
  'target.p99.meaning': 'Worst 1% (complaint source)',
  'target.stats':
    'Sample {s}/{t} succeeded · avg {avg} pulls · min {min} · max {max}',
  'target.chart.x': 'Pull count',
  'target.chart.y': 'Player count',
  'target.empty':
    'Click the button above to start — more useful than "100k MC" because it answers "how much to get the target"',
  'target.help':
    'X: pulls needed to acquire "{name}" · Y: number of players reaching that count · dashed lines mark P50/P75/P90/P99',

  // FormulaComparePanel
  'formula.title': '⚠ Formula vs Engine Measured',
  'formula.sample_small': '{n} pulls — small sample',
  'formula.sample_ok': '{n} pulls — statistically reliable',
  'formula.not_run': 'Not yet run',
  'formula.help':
    'The spreadsheet formula `expected per pull = random_p + 1/period` is a designer\'s approximation. Under A1 replacement-style cyclic pity, true probability is lower. The bigger the gap, the more optimistic your economy model is.',
  'formula.col.bucket': 'Bucket',
  'formula.col.formula_p': 'Formula P',
  'formula.col.theory_p': 'A1 Theory P',
  'formula.col.observed_p': 'Engine P',
  'formula.col.deviation': 'Formula gap',
  'formula.action':
    "📌 Action: in your economy model (ARPU / bundle pricing), replace formula P with the A1 Theory P column. The formula overstates real-world drop rates.",

  // EconomyPanel
  'economy.title': '💰 Economy',
  'economy.cost_label': 'Avg cost (¥/pull)',
  'economy.hint':
    'Typical ranges: pure normal pull ≈ ¥6-10, mixed ticket + monthly ≈ ¥3-7',
  'economy.total': 'Total {n} pulls spend',
  'economy.no_data': 'After running a sim, per-type average cost shown here',
  'economy.by_type': 'Average acquisition cost:',
  'economy.per_item': 'Each {type}',

  // HeadlineDropRate
  'headline.title': 'Core drop rate',
  'headline.bucket_label': 'Core resource',
  'headline.theoretical': 'Base rate',
  'headline.effective': 'Effective P',
  'headline.observed': 'Observed',
  'headline.deviation': 'Δ',
  'headline.count': '{obs} / {total} pulls',
  'headline.empty': '— · run a sim to see observed',
  'headline.featured_tag': 'Featured items in this bucket',
  'headline.lowest_tag': 'Lowest base-rate bucket',
  'headline.auto_prefix': 'Auto',
  'headline.bucket_select': 'Pick core resource',
  'headline.optgroup.bucket': '── Bucket level (一级 buckets) ──',
  'headline.optgroup.item': '── Item level (具体物品) ──',
  'headline.pity_tag': 'with pity',
  'headline.base_rate_hint': 'Pure weight ratio (no pity)',
  'headline.pity_hint': 'After cyclic-pity adjustment',
  'headline.no_pity_hint': 'No pity affects this rate',
  'headline.dev_vs_eff': 'Observed − Effective',
  'headline.eq_pulls': 'E[pulls / hit]',
  'headline.pulls_unit': 'pulls',
  'headline.per_10': 'per 10',
  'headline.per_50': 'per 50',
  'headline.per_100': 'per 100',
  'headline.unit': '',

  // DistributionChart
  'dist.title': 'Item drop distribution',
  'dist.empty': 'Run a simulation to see item distribution',
  'dist.total': '{n} pulls',
  'dist.theoretical_only': 'Theoretical only — run a sim to compare',
  'dist.series.theoretical': 'Theoretical',
  'dist.series.observed': 'Observed',
  'dist.tooltip.bucket': 'Bucket',
  'dist.tooltip.count': 'Count',
  'dist.tooltip.percent': 'Share',
  'dist.tooltip.theoretical': 'Theoretical',
  'dist.tooltip.observed': 'Observed',

  // Tab nav
  'nav.tab.pool': '⚙ Pool config',
  'nav.tab.sim': '🎲 Simulate & results',

  // LootHaulPanel
  'loot.title': '📦 Loot summary (by category)',
  'loot.total_pulls': '{n} pulls',
  'loot.empty': 'Pool has no items — nothing to summarize',
  'loot.theoretical_only': 'Showing theoretical expectations only — run a sim to see actual drops',
  'loot.hide_zero': 'Hide zero-rate items',
  'loot.items_unit': 'items',
  'loot.col.item': 'Item',
  'loot.col.theoretical': 'Expected',
  'loot.col.observed': 'Got',
  'loot.col.delta': 'Δ',
  'loot.col.rate': '/pull',
  'loot.help':
    'Expected = N pulls × per-pull EFFECTIVE probability (pity-adjusted, matches what the engine produces). Got = actual count after N pulls. Δ = (Got − Expected) / Expected — should be pure sampling noise. Items grouped by `type`.',
} as const

const zh: Record<keyof typeof en, string> = {
  // App shell
  'app.title': '抽卡模拟器',
  'app.subtitle': '数值策划决策工具 · 多方案管理',
  'app.footer':
    'Engine: plugin-rule architecture · A1 周期保底 · 200k 蒙模 ±0.4% vs 理论 · localStorage 持久化',

  // Language toggle
  'lang.toggle.title': '切换语言',

  // ConfigSelector
  'config.default_suffix': '(默认)',
  'config.rename': '重命名',
  'config.duplicate': '复制',
  'config.export': '导出',
  'config.import_json': '导入 JSON',
  'config.import_xlsx': '导入 xlsx',
  'config.import_xlsx_running': '解析中…',
  'config.delete': '删除',
  'config.reset_default': '重置默认',
  'config.tip.rename': '重命名当前方案',
  'config.tip.duplicate': '复制当前为新方案并切换',
  'config.tip.export': '导出当前方案为 JSON 文件',
  'config.tip.import_json': '从 JSON 文件导入方案',
  'config.tip.import_xlsx': '导入多个 xlsx 配置表（自动识别 R03/R05 约定）',
  'config.tip.delete_default': '默认方案不能删除',
  'config.tip.delete': '删除当前方案',
  'config.tip.reset_default': '将默认方案恢复为原始数据',
  'config.tip.dropdown': '当前方案 ID: {id}',
  'config.msg.switched': '已切换到「{name}」',
  'config.msg.duplicated': '已复制为新方案',
  'config.msg.deleted': '已删除「{name}」',
  'config.msg.exported': '已下载 JSON',
  'config.msg.import_failed': '导入失败: {msg}',
  'config.msg.imported_with_warnings': '已导入，但有 {n} 条警告（看控制台）',
  'config.msg.imported': '已导入并切换到新方案',
  'config.msg.parse_failed': 'JSON 解析失败: {msg}',
  'config.msg.xlsx_failed': 'xlsx 导入失败: {msg}',
  'config.msg.xlsx_imported_warn': '已导入({s})，{n} 个警告（看控制台）',
  'config.msg.xlsx_imported': '已导入并切换到新方案 ({s})',
  'config.msg.reset_ok': '已恢复默认方案',
  'config.confirm.delete': '确定删除方案「{name}」？',
  'config.confirm.reset': '将默认方案恢复为原始配置（你对默认方案的修改会丢失）？',

  // PoolSummary
  'pool.col.bucket': 'Bucket',
  'pool.col.name': '名称',
  'pool.col.weight': '权重',
  'pool.col.base_prob': '基础概率',
  'pool.col.items': '物品',
  'pool.add_bucket': '+ 添加 Bucket',
  'pool.rules.header': '规则',
  'pool.rules.empty': '暂无规则（纯随机池）',
  'pool.rules.add_cyclic': '+ 添加周期保底',
  'pool.rules.cyclic_label': 'cyclic-pity · 每',
  'pool.rules.cyclic_force': '抽强制',
  'pool.rules.script_label': '前 {n} 抽脚本',
  'pool.contents.header': '「{name}」内容物（二级开箱权重 / 物品）',
  'pool.contents.add_item': '+ 添加物品',
  'pool.contents.col.resId': 'resId',
  'pool.contents.col.name': '名称',
  'pool.contents.col.weight': '权重',
  'pool.contents.col.percent': '箱内 %',
  'pool.contents.help':
    '改权重 = 其他物品保持不变，所有 % 重新归一化｜改概率% = 引擎反推此物品权重，其他物品的绝对权重不变（其%会跟着调整）',
  'pool.tooltip.bucket_weight': '点击修改一级权重',
  'pool.tooltip.expand': '展开编辑内容物',
  'pool.tooltip.collapse': '收起内容物',
  'pool.tooltip.delete_bucket': '删除此 bucket',
  'pool.tooltip.edit_weight': '点击编辑权重',
  'pool.tooltip.edit_percent':
    '点击直接编辑此物品在 bucket 内的概率（引擎自动反推权重，保持其他物品绝对权重不变）',
  'pool.tooltip.delete_item': '删除此物品',
  'pool.tooltip.delete_rule': '删除此规则',
  'pool.tooltip.tip_edit': '点击编辑',
  'pool.confirm.last_bucket': '至少要保留 1 个 bucket',
  'pool.confirm.last_item': '每个 bucket 至少要保留 1 个物品',
  'pool.confirm.delete_bucket': '删除 bucket "{id}"？此 bucket 下所有物品配置也会被删除。',
  'pool.confirm.delete_rule': '删除这条规则？',
  'pool.percent.invalid': '概率必须在 0% (独占) 和 100% (独占) 之间',
  'pool.percent.single_item': '该 bucket 只有一个物品；无法独立设置概率',

  // SimControls
  'sim.title': '模拟控制',
  'sim.total': '累计 {n} 抽',
  'sim.btn.1': '1 抽',
  'sim.btn.10': '10 连',
  'sim.btn.100': '100 抽',
  'sim.btn.100k': '10万次蒙模',
  'sim.running': '运行中…',
  'sim.reset': '清空累计（重新初始化保底计数器）',
  'sim.help': '多次点击累加，保底计数器跨点击保持',
  'sim.last_elapsed': '上次: {n}ms',
  'sim.error': '模拟失败',

  // TargetSimPanel
  'target.title': '🎯 目标驱动模拟（分位数视角）',
  'target.field.target': '目标物品',
  'target.field.trials': '玩家数 (trials)',
  'target.field.max_pulls': '最多抽数 / 玩家',
  'target.field.cost': '¥/抽',
  'target.btn.run': '跑 {n} 个玩家 抽到「{name}」',
  'target.btn.running': '运行中…',
  'target.failure_warn':
    '⚠ {pct}% 玩家在 {n} 抽内 没拿到（被 cap 截断；真实成本更高）',
  'target.col.percentile': '分位',
  'target.col.pulls': '抽数',
  'target.col.cost': '¥ 成本',
  'target.col.meaning': '含义',
  'target.p50.meaning': '中位玩家',
  'target.p75.meaning': '25% 玩家更贵',
  'target.p90.meaning': '倒霉 10% 阈值',
  'target.p99.meaning': '极不幸 1%（差评源）',
  'target.stats': '样本 {s}/{t} 成功 · 平均 {avg} 抽 · min {min} · max {max}',
  'target.chart.x': '抽数',
  'target.chart.y': '玩家数',
  'target.empty':
    '点上方按钮开始模拟 — 比 "10 万次蒙模" 更有用，因为它回答的是 "拿到目标要多少钱"',
  'target.help':
    '横轴：抽到「{name}」所需的抽数 · 纵轴：达成所需抽数的玩家人数 · 虚线标注 P50/P75/P90/P99 分位',

  // FormulaComparePanel
  'formula.title': '⚠ 公式 vs 引擎实测',
  'formula.sample_small': '{n} 抽样本偏小',
  'formula.sample_ok': '{n} 抽统计可信',
  'formula.not_run': '尚未运行',
  'formula.help':
    '表格里 含保底每抽期望 = 随机概率 + 1/周期 是策划近似算法，实际游戏在 A1 替换式保底下会比公式偏低。差异越大，意味着你按公式做的经济模型越乐观。',
  'formula.col.bucket': 'Bucket',
  'formula.col.formula_p': '表格公式 P',
  'formula.col.theory_p': 'A1 理论 P',
  'formula.col.observed_p': '引擎实测 P',
  'formula.col.deviation': '公式偏离',
  'formula.action':
    '📌 行动建议：经济模型里用到含保底概率的地方（ARPU / 礼包定价），应该用 "A1 理论 P" 列重新校准。表格里写的公式会让你高估玩家实际获取速度。',

  // EconomyPanel
  'economy.title': '💰 经济换算',
  'economy.cost_label': '假设平均成本（¥/抽）',
  'economy.hint': '按二游常规水平：纯普通抽 ≈ ¥6-10/抽，混合用券/月卡 ≈ ¥3-7/抽',
  'economy.total': '累计 {n} 抽花费',
  'economy.no_data': '运行模拟后这里显示分类平均成本',
  'economy.by_type': '平均获取成本：',
  'economy.per_item': '每件 {type}',

  // DistributionChart
  'headline.title': '核心资源掉率',
  'headline.bucket_label': '核心资源',
  'headline.theoretical': '基础概率',
  'headline.effective': '有效概率',
  'headline.observed': '实测概率',
  'headline.deviation': '偏差',
  'headline.count': '{obs} / {total} 抽',
  'headline.empty': '— · 跑模拟看实测',
  'headline.featured_tag': '此 bucket 含 featured item',
  'headline.lowest_tag': '基础概率最低 bucket',
  'headline.auto_prefix': '自动',
  'headline.bucket_select': '选择核心资源',
  'headline.optgroup.bucket': '── 一级 Bucket(整箱命中)──',
  'headline.optgroup.item': '── 具体物品(二级开箱)──',
  'headline.pity_tag': '含保底',
  'headline.base_rate_hint': '纯权重比,不含保底',
  'headline.pity_hint': 'cyclic-pity 修正后真实概率',
  'headline.no_pity_hint': '此资源不受保底影响',
  'headline.dev_vs_eff': '实测 − 有效',
  'headline.eq_pulls': '期望抽数/次',
  'headline.pulls_unit': '抽',
  'headline.per_10': '10 抽期望',
  'headline.per_50': '50 抽期望',
  'headline.per_100': '100 抽期望',
  'headline.unit': '件',

  'dist.title': '物品获取分布',
  'dist.empty': '运行模拟后这里会显示物品分布',
  'dist.total': '共 {n} 抽',
  'dist.theoretical_only': '理论值 · 跑一次模拟可对比实测',
  'dist.series.theoretical': '理论',
  'dist.series.observed': '实测',
  'dist.tooltip.bucket': 'Bucket',
  'dist.tooltip.count': '次数',
  'dist.tooltip.percent': '占比',
  'dist.tooltip.theoretical': '理论',
  'dist.tooltip.observed': '实测',

  // Tab nav
  'nav.tab.pool': '⚙ 池子配置',
  'nav.tab.sim': '🎲 模拟产出',

  // LootHaulPanel
  'loot.title': '📦 获得物品总结(按类别）',
  'loot.total_pulls': '累计 {n} 抽',
  'loot.empty': '池子没有物品 — 没有可汇总的内容',
  'loot.theoretical_only': '当前仅展示理论期望 — 跑一次模拟可查看实际掉落',
  'loot.hide_zero': '隐藏零概率物品',
  'loot.items_unit': '种',
  'loot.col.item': '物品',
  'loot.col.theoretical': '期望',
  'loot.col.observed': '实际',
  'loot.col.delta': '偏差',
  'loot.col.rate': '/抽',
  'loot.help':
    '期望 = N 抽 × 每抽「有效概率」(含保底修正,与引擎实际产出一致);实际 = N 抽后真实掉落数;偏差 = (实际 − 期望) / 期望,正常情况下应为纯采样噪声。物品按 `type` 聚合。',
}

export const translations: Record<Lang, Record<keyof typeof en, string>> = {
  en,
  zh,
}

export type TranslationKey = keyof typeof en

export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}
