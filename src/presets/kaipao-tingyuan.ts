/**
 * 塔防项目 庭院 S 皮肤抽卡 池 — auto-generated from
 *   F:/kaipaogame/doc/trunk/塔防数据配置/{S皮肤抽卡, 宝箱配置, W-物品表, gem宝石, S-皮肤}.xlsx
 *
 * Regenerate via:  node scripts/build-kaipao-preset.mjs
 *
 * Source: skinBox.json id=1 "庭院" / itemBoxPro.json
 * Buckets:
 *   20000 (S 皮肤箱)    weight 3       bigBaodi T=50
 *   10014 (普通宝石箱)   weight 500     smallBaodi T=10
 *   10015 (璀璨宝石箱)   weight 150     无保底
 *   10028 (道具箱)      weight 7000    无保底
 *
 * DO NOT EDIT BY HAND — change source xlsx + rerun the script.
 */
import type { z } from 'zod'
import type { PoolSchema } from '../engine/schema'

type Pool = z.input<typeof PoolSchema>

export const kaipaoTingyuanPool: Pool = {
  "id": "kaipao-tingyuan",
  "name": "塔防 庭院 S 皮肤池",
  "description": "塔防项目 庭院池(skinBox.json id=1)— 含 50/10 双保底、4 个一级 bucket(S 皮肤箱 / 普通宝石箱 / 璀璨宝石箱 / 道具箱)。注:首抽脚本因引用池外物品(宝石装备部位)已省略,不影响稳态概率。",
  "buckets": [
    {
      "id": "20000",
      "name": "测试皮肤箱子",
      "kind": "box",
      "weight": 3,
      "color": "#fbbf24",
      "contents": [
        {
          "resId": "80001",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80002",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80003",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80005",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80007",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80008",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80009",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80010",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "80011",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "90101",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "90102",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "90106",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "90107",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "90108",
          "weight": 7100,
          "minCount": 1,
          "maxCount": 1
        }
      ]
    },
    {
      "id": "10014",
      "name": "普通宝石箱",
      "kind": "box",
      "weight": 500,
      "color": "#a78bfa",
      "contents": [
        {
          "resId": "1",
          "weight": 1,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "2",
          "weight": 1,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "3",
          "weight": 6000,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "4",
          "weight": 71500,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "5",
          "weight": 22490,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "6",
          "weight": 9,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "7",
          "weight": 1,
          "minCount": 1,
          "maxCount": 1
        }
      ]
    },
    {
      "id": "10015",
      "name": "璀璨宝石箱",
      "kind": "box",
      "weight": 150,
      "color": "#f472b6",
      "contents": [
        {
          "resId": "2",
          "weight": 1,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "3",
          "weight": 1,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "4",
          "weight": 117,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "5",
          "weight": 117,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "6",
          "weight": 510,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "7",
          "weight": 256,
          "minCount": 1,
          "maxCount": 1
        }
      ]
    },
    {
      "id": "10028",
      "name": "Bucket 10028",
      "kind": "box",
      "weight": 7000,
      "color": "#94a3b8",
      "contents": [
        {
          "resId": "10001",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10002",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10003",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10004",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10005",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10006",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10008",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10009",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10010",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10101",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10102",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10103",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10104",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10105",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10106",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10107",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10108",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10109",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10110",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10111",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10112",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10113",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10114",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "10115",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "11001",
          "weight": 3200,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "11002",
          "weight": 2500,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "11003",
          "weight": 1000,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "11004",
          "weight": 100,
          "minCount": 1,
          "maxCount": 1
        },
        {
          "resId": "11005",
          "weight": 20,
          "minCount": 1,
          "maxCount": 1
        }
      ]
    }
  ],
  "items": [
    {
      "resId": "80001",
      "name": "莉亚",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80002",
      "name": "卡莲娜",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80003",
      "name": "艾拉娜",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80005",
      "name": "栗小奈",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80007",
      "name": "殷桃",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80008",
      "name": "喵莉贝尔",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80009",
      "name": "卡西",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80010",
      "name": "卡芙琳",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "80011",
      "name": "薇拉",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "90101",
      "name": "皮肤90101",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "90102",
      "name": "皮肤90102",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "90106",
      "name": "皮肤90106",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "90107",
      "name": "皮肤90107",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "90108",
      "name": "皮肤90108",
      "type": "皮肤",
      "quality": "S 级",
      "isFeatured": false
    },
    {
      "resId": "1",
      "name": "白色宝石",
      "type": "宝石",
      "quality": "T1",
      "isFeatured": false
    },
    {
      "resId": "2",
      "name": "绿色宝石",
      "type": "宝石",
      "quality": "T2",
      "isFeatured": false
    },
    {
      "resId": "3",
      "name": "蓝色宝石",
      "type": "宝石",
      "quality": "T3",
      "isFeatured": false
    },
    {
      "resId": "4",
      "name": "紫色宝石",
      "type": "宝石",
      "quality": "T4",
      "isFeatured": false
    },
    {
      "resId": "5",
      "name": "金色宝石",
      "type": "宝石",
      "quality": "T5",
      "isFeatured": false
    },
    {
      "resId": "6",
      "name": "红色宝石",
      "type": "宝石",
      "quality": "T6",
      "isFeatured": false
    },
    {
      "resId": "7",
      "name": "多彩宝石",
      "type": "宝石",
      "quality": "T7",
      "isFeatured": false
    },
    {
      "resId": "10001",
      "name": "枪械强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10002",
      "name": "头盔强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10003",
      "name": "战衣强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10004",
      "name": "项链强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10005",
      "name": "戒指强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10006",
      "name": "战靴强化蓝图",
      "type": "装备图纸",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10008",
      "name": "能源合金",
      "type": "其他物品",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10009",
      "name": "硅晶魔方",
      "type": "其他物品",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10010",
      "name": "超频芯片",
      "type": "魔力符石",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "10101",
      "name": "脉冲射击芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10102",
      "name": "炽裂弹芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10103",
      "name": "霜冻射线芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10104",
      "name": "电磁轰击芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10105",
      "name": "星际战车芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10106",
      "name": "磁暴激光芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10107",
      "name": "圣光速射芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10108",
      "name": "冰爆芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10109",
      "name": "链式闪电芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10110",
      "name": "星陨芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10111",
      "name": "暗物质芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10112",
      "name": "电磁网芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10113",
      "name": "熔岩突刺芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10114",
      "name": "能量球芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "10115",
      "name": "模拟黑洞芯片",
      "type": "魔力符石",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "11001",
      "name": "糯米丸子",
      "type": "其他物品",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "11002",
      "name": "情人节巧克力",
      "type": "其他物品",
      "quality": "3",
      "isFeatured": false
    },
    {
      "resId": "11003",
      "name": "刺身拼盘",
      "type": "其他物品",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "11004",
      "name": "月海虾蛋面",
      "type": "其他物品",
      "quality": "4",
      "isFeatured": false
    },
    {
      "resId": "11005",
      "name": "鲜香烤乳猪",
      "type": "其他物品",
      "quality": "5",
      "isFeatured": false
    }
  ],
  "drawModes": [
    {
      "id": "normal",
      "label": "普通抽",
      "costResId": "6",
      "costPerOne": 200,
      "costPerTen": 1800
    },
    {
      "id": "ticket",
      "label": "用券抽",
      "costResId": "10020",
      "costPerOne": 1,
      "costPerTen": 10
    }
  ],
  "rules": [
    {
      "type": "cyclic-pity",
      "params": {
        "period": 50,
        "bucketId": "20000"
      }
    },
    {
      "type": "cyclic-pity",
      "params": {
        "period": 10,
        "bucketId": "10014"
      }
    }
  ]
}

export const kaipaoExpectedDistribution = {
  // Closed-form per-pull effective probability (含保底). MC 验证 ±0.4%.
  buckets: {
    '20000': 0.02017,   // S 皮肤箱  (含 50 抽硬保底)
    '10014': 0.13172,   // 普通宝石箱 (含 10 抽硬保底)
    '10015': 0.01779,   // 璀璨宝石箱
    '10028': 0.83034,   // 道具箱
  },
  gemPerPull: 0.14951,  // 普通箱 + 璀璨箱 加总(因两箱全部 100% 是宝石)
  perGrade: {
    1: 0.00000132,  // 白色宝石
    2: 0.0000191,   // 绿色宝石
    3: 0.00792,     // 蓝色宝石
    4: 0.09625,     // 紫色宝石
    5: 0.03170,     // 金色宝石
    6: 0.00907,     // 红色宝石
    7: 0.00455,     // 多彩宝石
  },
} as const
