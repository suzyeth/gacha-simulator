# Sample Pool JSON Configs

Drop these into the simulator via 顶栏 "导入" 按钮 to load them as new schemes.

## Files

### `xm-保底紧缩版.json`

Same as XM default pool but with tighter pity:
- `smallBaodi` 周期: 10 → **8**
- `bigBaodi` 周期: 50 → **40**

**Use case**: after importing this, switch between default and this version to
see how loosening保底 affects P50/P90 cost. Expect significantly cheaper P99
(unlucky-tail) values but slightly higher average drop frequency.

### `minimal-pool.json`

The smallest possible valid `PoolSchema`:
- 1 bucket (`main`) with 3 items at descending weights
- 1 cyclic-pity rule (every 100 pulls force the bucket — degenerate since it's the only bucket, just used to verify schema parsing)

**Use case**: reference template for hand-writing new configs. Copy and modify.

## Schema reference

See `src/engine/schema.ts` for the full Zod schema. Key required fields:

- **Pool**: `id`, `name`, `buckets[]` (at least 1)
- **Bucket**: `id`, `weight`, `contents[]` (at least 1)
- **BucketContent**: `resId`, `weight` (defaults to 1)
- **Item**: `resId`, `name`
- **Rule** (discriminated union by `type`):
  - `cyclic-pity` — params: `{ period: number, bucketId: string }`
  - `first-draw-script` — params: `{ script: [{ resId, count? }, ...] }`

Most other fields have defaults — see schema for full list.

## Round-trip workflow

1. 在 UI 顶栏点 **"导出"** 当前方案 → 下载 JSON 文件
2. 用文本编辑器（VS Code / Notepad / Sublime）改字段值
3. 在 UI 点 **"导入"** → 选改后的文件
4. 新方案自动加入下拉列表并切到它
5. 跑模拟，看效果差异

如果 JSON 有 schema 错误，UI 顶栏会弹红色错误提示，控制台也会输出详细 issue 列表。
