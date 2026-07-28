import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PRIMARY = 'https://www.kj1868.cc'
const BACKUP = 'https://www.kj1868.com'
const GAME_CODE = 'bingosix'
const PAGE_SIZE = 100
const MAX_PAGES = 5

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
    const ea = BigInt(String(a.expect || '0').replace(/\D/g, '') || '0')
    const eb = BigInt(String(b.expect || '0').replace(/\D/g, '') || '0')

    if (ea !== eb) return eb > ea ? 1 : -1

    const ta = new Date(a.openTime || 0).getTime()
    const tb = new Date(b.openTime || 0).getTime()
    return tb - ta
  })
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)

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
      throw new Error('JSON 解析失败')
    }
  } finally {
    clearTimeout(timer)
  }
}

function extractList(json) {
  if (!json || String(json.status) !== '10') return []

  // 新版文档：data = { total, per_page, current_page, last_page, data: [...] }
  if (Array.isArray(json?.data?.data)) return json.data.data

  // 兼容旧版：data = [...]
  if (Array.isArray(json?.data)) return json.data

  return []
}

async function fetchPage(host, page = 1) {
  const url =
    `${host}/openapi/drawLottery/${GAME_CODE}/last.kj` +
    `?page=${page}&pageSize=${PAGE_SIZE}`

  const json = await fetchJson(url)

  if (String(json?.status) !== '10') {
    throw new Error(json?.message || '开奖接口返回失败状态')
  }

  const list = extractList(json)

  return {
    list,
    lastPage: Number(json?.data?.last_page || 1),
    url,
  }
}

async function fetchHistoryFromHost(host) {
  const first = await fetchPage(host, 1)

  const all = [...first.list]
  const pageCount = Math.max(
    1,
    Math.min(MAX_PAGES, Number(first.lastPage || 1))
  )

  // 最多拉5页，每页100条；接口如果只允许近期数据，也能正常工作。
  for (let page = 2; page <= pageCount; page += 1) {
    try {
      const result = await fetchPage(host, page)
      all.push(...result.list)
    } catch (error) {
      console.warn(`第${page}页读取失败：`, error.message)
      break
    }
  }

  return all
}

async function getBingoSixData() {
  let raw = []
  let sourceHost = PRIMARY
  let lastError = ''

  for (const host of [PRIMARY, BACKUP]) {
    try {
      raw = await fetchHistoryFromHost(host)
      if (raw.length) {
        sourceHost = host
        break
      }
    } catch (error) {
      lastError = error.message
      console.warn(`${host} 获取失败：`, error.message)
    }
  }

  if (!raw.length) {
    throw new Error(
      `没有获取到宾果六合彩开奖数据${lastError ? `：${lastError}` : ''}`
    )
  }

  const uniqueMap = new Map()

  raw.forEach((item) => {
    const normalized = normalizeItem(item)
    if (normalized?.expect) {
      uniqueMap.set(normalized.expect, normalized)
    }
  })

  const history = sortHistory(Array.from(uniqueMap.values()))

  if (!history.length) {
    throw new Error('接口有返回，但没有解析到有效的7个开奖号码')
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
    history: history.slice(0, 500),
    recentHistory: history.slice(0, 50),
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
