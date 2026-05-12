function firstArray(obj, keys) {
  if (!obj || typeof obj !== 'object') return []
  for (const key of keys) {
    const v = obj[key]
    if (Array.isArray(v)) return v
  }
  return []
}

function labelOf(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') {
      return String(row[k]).trim()
    }
  }
  return '—'
}

function countOf(row) {
  const n = Number(
    row.count ?? row.value ?? row.total ?? row.patients ?? row.n ?? 0,
  )
  return Number.isFinite(n) ? n : 0
}

/**
 * GET /api/stats 응답을 차트용 배열로 정규화합니다.
 * 백엔드 필드명이 다르면 아래 후보 키 목록을 확장하세요.
 */
export function normalizeStatsPayload(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const nested =
    data.data && typeof data.data === 'object' ? data.data : data

  const deptRows = firstArray(nested, [
    'patientsByDepartment',
    'byDepartment',
    'departmentStats',
    'departments',
    '진료과별',
  ])
  const departmentData = deptRows.map((row) => ({
    name: labelOf(row, ['department', 'name', 'label', 'key', '진료과']),
    count: countOf(row),
  }))

  const bloodRows = firstArray(nested, [
    'patientsByBloodType',
    'byBloodType',
    'bloodTypeStats',
    'bloodTypes',
    '혈액형별',
  ])
  const bloodTypeData = bloodRows.map((row) => ({
    name: labelOf(row, ['bloodType', 'type', 'name', 'label', '혈액형']),
    value: countOf(row),
  }))

  const monthRows = firstArray(nested, [
    'recentCheckupsByMonth',
    'checkupsByMonth',
    'monthlyCheckups',
    'byMonth',
    'lastCheckupByMonth',
    '월별',
  ])
  const monthlyData = monthRows.map((row) => ({
    name: labelOf(row, ['month', 'yearMonth', 'period', 'label', '날짜']),
    count: countOf(row),
  }))

  return { departmentData, bloodTypeData, monthlyData }
}
