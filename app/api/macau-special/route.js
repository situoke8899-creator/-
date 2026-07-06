import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WINDOWS = [20, 50, 100, 200]
const MAX_HISTORY = 260

function getYears() {
  const year = new Date().getFullYear()
  return [year, year - 1]
}

async function fetchJson(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0',
    },
  })

  const text = await res.text()

  if (!res.ok) throw new Error(`接口请求失败：${url}`)
  if (!text.trim()) throw new Error(`接口返回空内容：${url}`)
  if (text.trim().startsWith('<')) throw new Error(`接口返回网页，不是JSON：${url}`)

  return JSON.parse(text)
}

function parseOpenCode(openCode) {
  return String(openCode || '')
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((num) => Number.isInteger(num) && num >= 1 && num <= 49)
}

function normalizeRows(json) {
  const rows = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.list)
    ? json.list
    : Array.isArray(json)
    ? json
    : []

  return rows
    .map((item) => {
      const numbers = parseOpenCode(item.openCode)
      const specialNumber = numbers[numbers.length - 1]

      if (numbers.length < 7 || !Number.isInteger(specialNumber)) return null

      return {
        expect: String(item.expect || ''),
        openTime: item.openTime || item.time || '',
        openCode: numbers.map((num) => String(num).padStart(2, '0')).join(','),
        numbers,
        specialNumber,
        specialCode: String(specialNumber).padStart(2, '0'),
      }
    })
    .filter(Boolean)
}

async function getHistory() {
  const all = []
  const errors = []

  for (const year of getYears()) {
    const url = `https://history.macaumarksix.com/history/macaujc2/y/${year}`

    try {
      const json = await fetchJson(url)
      all.push(...normalizeRows(json))
    } catch (error) {
      errors.push(error.message)
    }
  }

  const map = new Map()
  all.forEach((item) => {
    if (item.expect) map.set(item.expect, item)
  })

  const history = Array.from(map.values())
    .sort((a, b) => {
      const ea = Number(a.expect || 0)
      const eb = Number(b.expect || 0)
      if (eb !== ea) return eb - ea
      return new Date(b.openTime || 0).getTime() - new Date(a.openTime || 0).getTime()
    })
    .slice(0, MAX_HISTORY)

  if (!history.length) {
    throw new Error(errors[0] || '没有获取到澳门六合彩开奖历史')
  }

  return history
}

function calcCurrentMiss(history, num) {
  let miss = 0

  for (const row of history) {
    if (row.specialNumber === num) break
    miss += 1
  }

  return miss
}

function buildRank(history, size) {
  const source = history.slice(0, size)

  const rows = Array.from({ length: 49 }, (_, index) => {
    const num = index + 1
    return {
      num,
      code: String(num).padStart(2, '0'),
      count: 0,
      rate: 0,
      currentMiss: 0,
      lastExpect: '',
      lastOpenTime: '',
    }
  })

  source.forEach((item) => {
    const num = Number(item.specialNumber)
    if (!Number.isInteger(num) || num < 1 || num > 49) return

    const row = rows[num - 1]
    row.count += 1

    if (!row.lastExpect) {
      row.lastExpect = item.expect
      row.lastOpenTime = item.openTime
    }
  })

  rows.forEach((row) => {
    row.rate = source.length ? Number(((row.count / source.length) * 100).toFixed(2)) : 0
    row.currentMiss = calcCurrentMiss(history, row.num)
  })

  return rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.currentMiss !== b.currentMiss) return a.currentMiss - b.currentMiss
    return a.num - b.num
  })
}

function buildRecommend(history) {
  const rank20 = buildRank(history, 20)
  const rank50 = buildRank(history, 50)
  const rank100 = buildRank(history, 100)
  const rank200 = buildRank(history, 200)

  const map = new Map()

  for (let num = 1; num <= 49; num++) {
    map.set(num, {
      num,
      code: String(num).padStart(2, '0'),
      score: 0,
      count20: 0,
      count50: 0,
      count100: 0,
      count200: 0,
      currentMiss: calcCurrentMiss(history, num),
    })
  }

  function addScore(rank, weight, key) {
    rank.forEach((item, index) => {
      const row = map.get(item.num)
      row.score += item.count * weight
      row[key] = item.count

      if (index < 10) {
        row.score += (10 - index) * weight * 0.12
      }
    })
  }

  addScore(rank20, 5, 'count20')
  addScore(rank50, 2.8, 'count50')
  addScore(rank100, 1.5, 'count100')
  addScore(rank200, 0.8, 'count200')

  Array.from(map.values()).forEach((row) => {
    if (row.currentMiss >= 15) row.score += 3
    if (row.currentMiss >= 25) row.score += 5
    row.score = Number(row.score.toFixed(2))
  })

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.count20 !== a.count20) return b.count20 - a.count20
      if (b.count50 !== a.count50) return b.count50 - a.count50
      return a.num - b.num
    })
    .slice(0, 10)
}

function hitRateForNumbers(history, numbers, size) {
  const source = history.slice(0, size)
  const set = new Set(numbers)
  const hitCount = source.filter((item) => set.has(item.specialNumber)).length

  let currentMiss = 0
  for (const item of source) {
    if (set.has(item.specialNumber)) break
    currentMiss += 1
  }

  return {
    size,
    testedCount: source.length,
    hitCount,
    missCount: source.length - hitCount,
    hitRate: source.length ? Number(((hitCount / source.length) * 100).toFixed(2)) : 0,
    currentMiss,
  }
}

export async function GET() {
  try {
    const history = await getHistory()
    const recommend = buildRecommend(history)
    const recommendNumbers = recommend.map((item) => item.num)

    const ranks = {}
    const recommendStats = {}

    WINDOWS.forEach((size) => {
      ranks[size] = buildRank(history, size)
      recommendStats[size] = hitRateForNumbers(history, recommendNumbers, size)
    })

    return NextResponse.json({
      ok: true,
      play: 'macaujc-special-no-password',
      source: 'history.macaumarksix.com/history/macaujc2',
      latest: history[0],
      history: history.slice(0, 200),
      ranks,
      recommend,
      recommendStats,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || '获取澳门六合彩特码数据失败',
      },
      { status: 500 }
    )
  }
}
