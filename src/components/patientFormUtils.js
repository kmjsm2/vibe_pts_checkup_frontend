function toInputDate(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function arrayishToLines(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}

export function emptyPatientForm() {
  return {
    chartNumber: '',
    name: '',
    birthDate: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodType: '',
    allergies: '',
    notes: '',
    department: '',
    attendingPhysician: '',
    lastCheckupDate: '',
    diagnosis: '',
    medications: '',
    recordSource: '',
    institutionCode: '',
    externalRecordId: '',
  }
}

function linesToArray(s) {
  if (s == null || String(s).trim() === '') return undefined
  const arr = String(s)
    .split(/[\n,，;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return arr.length ? arr : undefined
}

export function patientToForm(p) {
  const base = emptyPatientForm()
  if (!p) return base

  if (p.emergencyContact && typeof p.emergencyContact === 'object') {
    base.emergencyContactName =
      p.emergencyContact.name != null ? String(p.emergencyContact.name) : ''
    base.emergencyContactPhone =
      p.emergencyContact.phone != null ? String(p.emergencyContact.phone) : ''
  }

  for (const key of Object.keys(base)) {
    if (key === 'emergencyContactName' || key === 'emergencyContactPhone') continue
    if (p[key] == null) continue
    if (key === 'birthDate' || key === 'lastCheckupDate') {
      base[key] = toInputDate(p[key])
    } else if (key === 'allergies' || key === 'medications') {
      base[key] = arrayishToLines(p[key])
    } else {
      base[key] = String(p[key])
    }
  }
  return base
}

export function formToCreatePayload(form) {
  const payload = {}
  for (const [k, v] of Object.entries(form)) {
    if (k === 'emergencyContactName' || k === 'emergencyContactPhone') continue
    if (v === '' || v == null) continue
    payload[k] = v
  }

  const allergies = linesToArray(form.allergies)
  if (allergies) payload.allergies = allergies

  const medications = linesToArray(form.medications)
  if (medications) payload.medications = medications

  const en = form.emergencyContactName?.trim() ?? ''
  const ep = form.emergencyContactPhone?.trim() ?? ''
  if (en || ep) {
    payload.emergencyContact = {}
    if (en) payload.emergencyContact.name = en
    if (ep) payload.emergencyContact.phone = ep
  }

  return payload
}

export function formToPatchPayload(form, original) {
  const payload = {}
  const skip = new Set([
    'emergencyContactName',
    'emergencyContactPhone',
    'allergies',
    'medications',
  ])

  for (const k of Object.keys(form)) {
    if (skip.has(k)) continue
    const next = form[k]
    const prev =
      k === 'birthDate' || k === 'lastCheckupDate'
        ? toInputDate(original?.[k]) || ''
        : original?.[k] != null
          ? String(original[k])
          : ''
    const cur = next === '' ? '' : next
    if (cur !== prev) payload[k] = cur === '' ? '' : cur
  }

  const prevAllergies = arrayishToLines(original?.allergies)
  const nextAllergies = form.allergies ?? ''
  if (prevAllergies !== nextAllergies) {
    payload.allergies = nextAllergies
  }

  const prevMeds = arrayishToLines(original?.medications)
  const nextMeds = form.medications ?? ''
  if (prevMeds !== nextMeds) {
    payload.medications = nextMeds
  }

  const prevEn = original?.emergencyContact?.name ?? ''
  const prevEp = original?.emergencyContact?.phone ?? ''
  const nextEn = form.emergencyContactName ?? ''
  const nextEp = form.emergencyContactPhone ?? ''
  if (prevEn !== nextEn || prevEp !== nextEp) {
    payload.emergencyContact = {
      name: nextEn.trim(),
      phone: nextEp.trim(),
    }
  }

  return payload
}
