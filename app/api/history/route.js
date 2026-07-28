import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HOSTS = ['https://www.kj1868.cc', 'https://www.kj1868.com']
const GAME_CODE = 'bingosix'
const MAX_HISTORY = 100
const DAY_PAGE_SIZE = 100
const MAX_LOOKBACK_DAYS = 3
const TIMEOUT_MS = 12000

function parseNumbers(value) {
  if (!value) return []

  return String(value)
    .split(',')
    .map((n) => Number(String(n).trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 49)
}

function normalizeItem(item) {
  const numbers = parseNumbers(item?.numbers)

  if (numbers.length < 7) return null

  return {
    expect: String(item?.period || ''),
    openTime: item?.lottery_date || '',
    openCode: numbers.slice(0, 7).join(','),
    numbers: numbers.slice(0, 7),
    specialNumber: numbers[6],
  }
}

function sortHistory(list) {
  return [...list].sort((a, b) => {
    const ea = BigInt(String(a?.expect || '0').replace(/\D/g, '') || '0')
    const eb = BigInt(String(b?.expect || '0').replace(/\D/g, '') || '0')

    if (ea !== eb) return eb > ea ? 1 : -1

    const ta = new Date(a?.openTime || 0).getTime()
    const tb = new Date(b?.openTime || 0).getTime()

    return tb - ta
  })
}

function extractList(json) {
  if (!json || String(json?.status) !== '10') return []

  if (Array.isArray(json?.data?.data)) return json.data.data
  if (Array.isArray(json?.data)) return json.data

  return []
}

function formatChinaDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${map.year}${map.month}${map.day}`
}

function getChinaDateOffset(daysAgo = 0) {
  // 以北京时间当天中午作为基准，再往前减自然日，避免 UTC/Vercel 时区导致跨日错误
  const now = new Date()

  const chinaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const map = Object.fromEntries(chinaParts.map((part) => [part.type, part.value]))

  const base = new Date(
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      12,
      0,
      0
    )
  )

  base.setUTCDate(base.getUTCDate() - daysAgo)

  return formatChinaDate(base)
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
        referer:
          'https://www.kj1868.cc/view/historyLottery/historyRecord.html?gameKey=bingosix',
      },
    })

    const text = await res.text()

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    if (!text || !text.trim()) {
      throw new Error('接口返回空内容')
    }

    if (text.trim().startsWith('<')) {
      throw new Error('接口返回网页而不是 JSON')
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`JSON解析失败：${text.slice(0, 120)}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFromHosts(path) {
  let lastError = ''

  for (const host of HOSTS) {
    try {
      const url = `${host}${path}`
      const json = await fetchJson(url)

      if (String(json?.status) !== '10') {
        throw new Error(json?.message || `开奖接口状态：${json?.status || '未知'}`)
      }

      return {
        host,
        json,
        list: extractList(json),
      }
    } catch (error) {
      lastError = error?.message || '请求失败'
      console.warn(`[bingosix] ${host}${path} 获取失败：${lastError}`)
    }
  }

  throw new Error(lastError || '两个开奖源都请求失败')
}

async function fetchLatest() {
  // 官方说明六合类 last.kj 只返回近3期，这里只用它补最新开奖
  return fetchFromHosts(
    `/openapi/drawLottery/${GAME_CODE}/last.kj?page=1&pageSize=3`
  )
}

async function fetchDay(date) {
  // 官方按日期接口，每页最多100条
  return fetchFromHosts(
    `/openapi/drawLottery/${GAME_CODE}/day/${date}.kj?page=1&pageSize=${DAY_PAGE_SIZE}`
  )
}

function addUnique(map, items) {
  for (const item of items || []) {
    const normalized = normalizeItem(item)

    if (normalized?.expect) {
      map.set(normalized.expect, normalized)
    }
  }
}

async function getBingoSixData() {
  const uniqueMap = new Map()
  let sourceHost = HOSTS[0]
  const fetchedDates = []
  const warnings = []

  // 先抓官方“近期开奖”补最新3期
  try {
    const latestResult = await fetchLatest()
    sourceHost = latestResult.host
    addUnique(uniqueMap, latestResult.list)
  } catch (error) {
    warnings.push(`近期开奖读取失败：${error.message}`)
  }

  // 再按日期往前抓，直到凑够最近100期。
  // 宾果六合彩开奖频率较高，一般当天即可够100期；
  // 清晨不足100期时会自动继续抓昨天、前天。
  for (let daysAgo = 0; daysAgo < MAX_LOOKBACK_DAYS; daysAgo += 1) {
    if (uniqueMap.size >= MAX_HISTORY) break

    const date = getChinaDateOffset(daysAgo)

    try {
      const result = await fetchDay(date)
      sourceHost = result.host
      fetchedDates.push(date)
      addUnique(uniqueMap, result.list)
    } catch (error) {
      warnings.push(`${date}读取失败：${error.message}`)
    }
  }

  const history = sortHistory(Array.from(uniqueMap.values())).slice(0, MAX_HISTORY)

  if (!history.length) {
    throw new Error(
      `没有获取到宾果六合彩开奖数据${warnings.length ? `；${warnings.join('；')}` : ''}`
    )
  }

  const latest = history[0]

  let nextExpect = ''
  try {
    nextExpect = (BigInt(latest.expect) + 1n).toString()
  } catch {
    nextExpect = ''
  }

  return {
    ok: true,
    play: 'bingosix',
    source: `${sourceHost} / openapi / bingosix`,
    latest,
    nextExpect,

    // 最多最近100期
    history,
    recentHistory: history.slice(0, 50),

    historyCount: history.length,
    maxHistory: MAX_HISTORY,
    fetchedDates,
    warnings,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const data = await getBingoSixData()

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error('宾果六合彩接口错误：', error)

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || '获取开奖数据失败，请稍后刷新重试',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  }
}
