import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchStats } from '../api/stats.js'
import { STATS_API_URL } from '../config.js'
import { normalizeStatsPayload } from '../utils/statsNormalize.js'

const PIE_COLORS = [
  '#aa3bff',
  '#6366f1',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
]

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [departmentData, setDepartmentData] = useState([])
  const [bloodTypeData, setBloodTypeData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const raw = await fetchStats()
        if (cancelled) return
        const n = normalizeStatsPayload(raw)
        setDepartmentData(n.departmentData)
        setBloodTypeData(n.bloodTypeData)
        setMonthlyData(n.monthlyData)
      } catch (e) {
        if (!cancelled) {
          setError(e.message || '통계를 불러오지 못했습니다.')
          setDepartmentData([])
          setBloodTypeData([])
          setMonthlyData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="dashboard-page clinical-dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>대시보드</h1>
          <p className="dashboard-sub">
            통계 API: <code className="inline-code">{STATS_API_URL}</code>
          </p>
        </div>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="dashboard-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden />
          통계를 불러오는 중…
        </div>
      ) : (
        <div className="dashboard-charts">
          <section className="chart-card" aria-labelledby="chart-dept-title">
            <h2 id="chart-dept-title" className="chart-card-title">
              진료과별 환자 수
            </h2>
            {departmentData.length === 0 ? (
              <p className="chart-empty">표시할 데이터가 없습니다.</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={departmentData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text)', fontSize: 12 }}
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fill: 'var(--text)', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" name="환자 수" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="chart-card" aria-labelledby="chart-blood-title">
            <h2 id="chart-blood-title" className="chart-card-title">
              혈액형 분포
            </h2>
            {bloodTypeData.length === 0 ? (
              <p className="chart-empty">표시할 데이터가 없습니다.</p>
            ) : (
              <div className="chart-wrap chart-wrap-pie">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={bloodTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {bloodTypeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="chart-card chart-card-wide" aria-labelledby="chart-month-title">
            <h2 id="chart-month-title" className="chart-card-title">
              월별 최근검진 환자 수
            </h2>
            {monthlyData.length === 0 ? (
              <p className="chart-empty">표시할 데이터가 없습니다.</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={monthlyData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--text)', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="환자 수"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
