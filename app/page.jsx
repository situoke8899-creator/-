'use client'

import { useEffect, useMemo, useState } from 'react'

const WINDOWS = [20, 50, 100, 200]

function fmtPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`
}

function NumBadge({ num, active = true, small = false, special = false }) {
  return (
    <span className={`${active ? 'num active' : 'num'} ${small ? 'small' : ''} ${special ? 'special' : ''}`}>
      {String(num).padStart(2, '0')}
    </span>
  )
}

export default function Page() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [windowSize, setWindowSize] = useState(200)
  const [betAmount, setBetAmount] = useState(100)
  const [odds, setOdds] = useState(47)
  const [buyCount, setBuyCount] = useState(10)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/macau-special', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.message || '接口请求失败')
      setData(json)
    } catch (err) {
      setError(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const rank = data?.ranks?.[windowSize] || []
  const recommend = data?.recommend || []
  const latest = data?.latest
  const history = data?.history || []

  const recommendSet = useMemo(() => new Set(recommend.map((item) => item.num)), [recommend])

  const amount = Number(betAmount || 0)
  const oddsNumber = Number(odds || 0)
  const count = Number(buyCount || 0)
  const totalBet = amount * count
  const winReturn = amount * oddsNumber
  const profit = winReturn - totalBet
  const loseAmount = totalBet

  return (
    <main className="page">
      <style jsx global>{`
        *{box-sizing:border-box}
        body{margin:0;background:#07111f;color:#edf6ff;font-family:Arial,'Microsoft YaHei',sans-serif}
        .page{min-height:100vh;padding:28px;background:radial-gradient(circle at top,#17365e 0%,#07111f 48%,#050914 100%)}
        .wrap{max-width:1280px;margin:0 auto}
        .hero{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-bottom:18px}
        .card{background:rgba(15,27,48,.92);border:1px solid rgba(148,163,184,.22);border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.28);padding:22px;margin-bottom:18px}
        h1{font-size:34px;margin:0 0 10px}
        h2{font-size:22px;margin:0 0 14px}
        .muted{color:#a9bdd8;line-height:1.7}
        .grid{display:grid;grid-template-columns:1.35fr .75fr;gap:18px;align-items:start}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
        .stat{padding:14px;border-radius:14px;background:rgba(2,6,23,.34);border:1px solid rgba(148,163,184,.15)}
        .stat strong{font-size:22px;color:#4ade80}
        .latest{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .num{display:inline-flex;width:42px;height:42px;border-radius:12px;align-items:center;justify-content:center;background:#1e293b;border:1px solid #334155;color:#cbd5e1;font-weight:900}
        .num.active{background:#ef4444;border-color:#fecaca;color:#fff}
        .num.small{width:30px;height:30px;border-radius:9px;font-size:12px}
        .num.special{background:#f59e0b;border-color:#fde68a;color:#111827}
        .btn{border:none;border-radius:999px;padding:10px 16px;background:#38bdf8;color:#07111f;font-weight:900;cursor:pointer}
        .tabbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
        .tab{border:1px solid rgba(148,163,184,.25);background:#0f172a;color:#cbd5e1;border-radius:999px;padding:9px 14px;cursor:pointer;font-weight:800}
        .tab.active{background:#22c55e;color:#052e16;border-color:#86efac}
        table{width:100%;border-collapse:collapse}
        th,td{padding:12px 10px;border-bottom:1px solid rgba(148,163,184,.16);text-align:left;font-size:14px}
        th{color:#9fb2cc;background:rgba(2,6,23,.28)}
        .good{color:#4ade80;font-weight:900}
        .mid{color:#facc15;font-weight:900}
        .bad{color:#fb7185;font-weight:900}
        .bar{height:10px;border-radius:999px;background:#1e293b;overflow:hidden;min-width:120px}
        .bar span{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#22c55e);border-radius:999px}
        .toolbar{display:flex;gap:12px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
        .input{width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:16px}
        .input-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .history-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(148,163,184,.14)}
        .history-nums{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
        .error{padding:16px;border-radius:14px;background:rgba(239,68,68,.14);color:#fecaca;border:1px solid rgba(248,113,113,.3);margin-bottom:18px}
        @media(max-width:950px){.hero,.grid{display:block}.stats,.input-grid{grid-template-columns:1fr}.page{padding:16px}}
      `}</style>

      <div className="wrap">
        <section className="hero">
          <div className="card">
            <h1>澳门六合彩特码出现率排行系统</h1>
            <p className="muted">
              无密码版，打开直接使用。自动抓取最近200期开奖，只统计最后一个号码，也就是特码。按 20 / 50 / 100 / 200 期分别计算出现次数、出现率和当前遗漏，并自动推荐综合热度最高的10个号码。
            </p>

            <div className="stats">
              {WINDOWS.map((size) => {
                const stat = data?.recommendStats?.[size]
                return (
                  <div className="stat" key={size}>
                    <div className="muted">推荐10码近{size}期</div>
                    <strong>{fmtPercent(stat?.hitRate)}</strong>
                    <div className="muted">命中 {stat?.hitCount || 0}/{stat?.testedCount || 0} ｜ 连错 {stat?.currentMiss || 0}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h2>最新开奖</h2>
            <p className="muted">第 {latest?.expect || '-'} 期 ｜ {latest?.openTime || '-'}</p>
            <div className="latest">
              {(latest?.numbers || []).slice(0, 6).map((num, index) => (
                <NumBadge key={`${num}-${index}`} num={num} />
              ))}
              <strong>+</strong>
              {latest?.specialNumber && <NumBadge num={latest.specialNumber} special />}
            </div>
            <p className="muted">最新特码：{latest?.specialCode || '-'} ｜ 数据源：{data?.source || '-'}</p>
          </div>
        </section>

        <div className="toolbar">
          <button className="btn" onClick={loadData}>{loading ? '刷新中...' : '刷新数据'}</button>
          <span className="muted">更新时间：{data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-'}</span>
        </div>

        {error && <div className="error">{error}</div>}

        <section className="grid">
          <div>
            <div className="card">
              <h2>推荐10个特码</h2>
              <div className="latest">
                {recommend.map((item) => <NumBadge key={item.num} num={item.num} />)}
              </div>
              <p className="muted">综合评分 = 近20热度 + 近50稳定 + 近100基础 + 近200长期 + 遗漏补位。仅作历史统计参考，不保证未来结果。</p>
            </div>

            <div className="card">
              <h2>投注盈利计算</h2>
              <div className="input-grid">
                <div>
                  <div className="muted">单号金额</div>
                  <input className="input" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} />
                </div>
                <div>
                  <div className="muted">赔率</div>
                  <input className="input" value={odds} onChange={(e) => setOdds(e.target.value)} />
                </div>
                <div>
                  <div className="muted">购买号码数量</div>
                  <input className="input" value={buyCount} onChange={(e) => setBuyCount(e.target.value)} />
                </div>
              </div>
              <p className="muted">总投注：{totalBet.toFixed(2)}</p>
              <p className="muted">中奖返还：{winReturn.toFixed(2)}</p>
              <p className={profit >= 0 ? 'good' : 'bad'}>中奖净盈利：{profit.toFixed(2)}</p>
              <p className="bad">未中亏损：-{loseAmount.toFixed(2)}</p>
            </div>

            <div className="card">
              <h2>特码出现次数排行</h2>
              <div className="tabbar">
                {WINDOWS.map((size) => (
                  <button
                    key={size}
                    className={windowSize === size ? 'tab active' : 'tab'}
                    onClick={() => setWindowSize(size)}
                  >
                    近{size}期
                  </button>
                ))}
              </div>

              <table>
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>号码</th>
                    <th>出现次数</th>
                    <th>出现率</th>
                    <th>当前遗漏</th>
                    <th>热度</th>
                    <th>最近出现</th>
                  </tr>
                </thead>
                <tbody>
                  {rank.map((item, index) => (
                    <tr key={item.num}>
                      <td><strong>第{index + 1}</strong></td>
                      <td><NumBadge num={item.num} active={recommendSet.has(item.num)} /></td>
                      <td className="good">{item.count}次</td>
                      <td>{fmtPercent(item.rate)}</td>
                      <td className={item.currentMiss >= 20 ? 'mid' : ''}>{item.currentMiss}期</td>
                      <td><div className="bar"><span style={{ width: `${Math.min(100, item.rate * 8)}%` }} /></div></td>
                      <td className="muted">{item.lastExpect ? `第${item.lastExpect}期` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside>
            <div className="card">
              <h2>最近开奖记录</h2>
              {history.slice(0, 30).map((item) => (
                <div className="history-row" key={item.expect}>
                  <div>
                    <strong>第{item.expect}期</strong>
                    <div className="muted">{item.openTime}</div>
                    <div className="history-nums">
                      {item.numbers.slice(0, 6).map((num, index) => (
                        <NumBadge key={`${item.expect}-${num}-${index}`} num={num} small />
                      ))}
                      <strong>+</strong>
                      <NumBadge num={item.specialNumber} small special />
                    </div>
                  </div>
                  <div className={recommendSet.has(item.specialNumber) ? 'good' : 'bad'}>
                    {recommendSet.has(item.specialNumber) ? '推荐命中' : '未命中'}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
