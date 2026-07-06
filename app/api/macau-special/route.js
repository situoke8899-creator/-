import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WINDOWS = [20, 50, 100, 200]
const MAX_HISTORY = 260

function years() {
  const y = new Date().getFullYear()
  return [y, y - 1]
}

async function fetchJson(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
    cache: 'no-store',
    headers: { accept: 'application/json,text/plain,*/*', 'user-agent': 'Mozilla/5.0' },
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
    .map((n) => Number(String(n).trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 49)
}

function normalize(json) {
  const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json?.list) ? json.list : Array.isArray(json) ? json : []
  return rows.map((item) => {
    const numbers = parseOpenCode(item.openCode)
    const specialNumber = numbers[numbers.length - 1]
    if (numbers.length < 7 || !Number.isInteger(specialNumber)) return null
    return {
      expect: String(item.expect || ''),
      openTime: item.openTime || item.time || '',
      openCode: numbers.map((n) => String(n).padStart(2, '0')).join(','),
      numbers,
      specialNumber,
      specialCode: String(specialNumber).padStart(2, '0'),
      zodiac: item.zodiac || '',
      wave: item.wave || '',
    }
  }).filter(Boolean)
}

async function getHistory() {
  const all = []
  const errors = []
  for (const y of years()) {
    const url = `https://history.macaumarksix.com/history/macaujc2/y/${y}`
    try {
      const json = await fetchJson(url)
      all.push(...normalize(json))
    } catch (e) {
      errors.push(e.message)
    }
  }
  const map = new Map()
  all.forEach((item) => item.expect && map.set(item.expect, item))
  const history = Array.from(map.values()).sort((a,b) => {
    const ea = Number(a.expect || 0)
    const eb = Number(b.expect || 0)
    if (eb !== ea) return eb - ea
    return new Date(b.openTime || 0) - new Date(a.openTime || 0)
  }).slice(0, MAX_HISTORY)
  if (!history.length) throw new Error(errors[0] || '没有获取到澳门六合彩开奖历史')
  return history
}

function currentMiss(history, num) {
  let miss = 0
  for (const row of history) {
    if (row.specialNumber === num) break
    miss += 1
  }
  return miss
}

function buildRank(history, size) {
  const source = history.slice(0, size)
  const rows = Array.from({ length: 49 }, (_, i) => ({
    num: i + 1,
    code: String(i + 1).padStart(2, '0'),
    count: 0,
    rate: 0,
    currentMiss: 0,
    lastOpenTime: '',
    lastExpect: '',
  }))
  source.forEach((item) => {
    const num = Number(item.specialNumber)
    if (!Number.isInteger(num) || num < 1 || num > 49) return
    const row = rows[num - 1]
    row.count += 1
    if (!row.lastOpenTime) {
      row.lastOpenTime = item.openTime
      row.lastExpect = item.expect
    }
  })
  rows.forEach((row) => {
    row.rate = source.length ? Number(((row.count / source.length) * 100).toFixed(2)) : 0
    row.currentMiss = currentMiss(history, row.num)
  })
  return rows.sort((a,b) => b.count - a.count || a.currentMiss - b.currentMiss || a.num - b.num)
}

function buildRecommend(history) {
  const ranks = {
    20: buildRank(history, 20),
    50: buildRank(history, 50),
    100: buildRank(history, 100),
    200: buildRank(history, 200),
  }
  const map = new Map()
  for (let n = 1; n <= 49; n++) {
    map.set(n, { num:n, code:String(n).padStart(2,'0'), score:0, count20:0, count50:0, count100:0, count200:0, currentMiss: currentMiss(history,n) })
  }
  function add(rank, weight, key) {
    rank.forEach((item, index) => {
      const row = map.get(item.num)
      row.score += item.count * weight
      row[key] = item.count
      if (index < 10) row.score += (10 - index) * weight * 0.12
    })
  }
  add(ranks[20], 5, 'count20')
  add(ranks[50], 2.8, 'count50')
  add(ranks[100], 1.5, 'count100')
  add(ranks[200], 0.8, 'count200')
  Array.from(map.values()).forEach((row) => {
    if (row.currentMiss >= 15) row.score += 3
    if (row.currentMiss >= 25) row.score += 5
    row.score = Number(row.score.toFixed(2))
  })
  return Array.from(map.values()).sort((a,b) => b.score - a.score || b.count20 - a.count20 || b.count50 - a.count50 || a.num - b.num).slice(0,10)
}

function hitRate(history, numbers, size) {
  const source = history.slice(0, size)
  const set = new Set(numbers)
  const hitCount = source.filter((item) => set.has(item.specialNumber)).length
  let miss = 0
  for (const item of source) {
    if (set.has(item.specialNumber)) break
    miss += 1
  }
  return {
    size,
    testedCount: source.length,
    hitCount,
    missCount: source.length - hitCount,
    hitRate: source.length ? Number(((hitCount / source.length) * 100).toFixed(2)) : 0,
    currentMiss: miss,
  }
}

export async function GET() {
  try {
    const history = await getHistory()
    const recommend = buildRecommend(history)
    const nums = recommend.map((x) => x.num)
    const ranks = {}
    const recommendStats = {}
    WINDOWS.forEach((w) => {
      ranks[w] = buildRank(history, w)
      recommendStats[w] = hitRate(history, nums, w)
    })
    return NextResponse.json({
      ok:true,
      play:'macaujc-special',
      source:'history.macaumarksix.com/history/macaujc2',
      latest: history[0],
      history: history.slice(0,200),
      ranks,
      recommend,
      recommendStats,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ ok:false, message:e.message || '获取澳门六合彩特码数据失败' }, { status:500 })
  }
}
