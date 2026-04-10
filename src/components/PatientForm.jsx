import { emptyPatientForm } from './patientFormUtils.js'

const FIELD_LABELS = {
  chartNumber: '차트번호',
  name: '이름',
  birthDate: '생년월일',
  gender: '성별',
  phone: '전화번호',
  email: '이메일',
  address: '주소',
  emergencyContactName: '비상 연락처 이름',
  emergencyContactPhone: '비상 연락처 전화',
  bloodType: '혈액형',
  allergies: '알레르기',
  notes: '메모',
  department: '진료과',
  attendingPhysician: '담당의',
  lastCheckupDate: '최근 검진일',
  diagnosis: '진단',
  medications: '복용 약물',
  recordSource: '기록 출처',
  institutionCode: '기관 코드',
  externalRecordId: '외부 레코드 ID',
}

const TEXTAREA_KEYS = new Set(['allergies', 'notes', 'diagnosis', 'medications'])

const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export function PatientForm({ form, onChange, idPrefix = 'pf' }) {
  const keys = Object.keys(emptyPatientForm())

  return (
    <div className="patient-form-grid">
      {keys.map((key) => {
        const label = FIELD_LABELS[key]
        const id = `${idPrefix}-${key}`
        if (key === 'recordSource') {
          return (
            <label key={key} className="patient-field" htmlFor={id}>
              <span>{label}</span>
              <select
                id={id}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              >
                <option value="">기본 (clinical)</option>
                <option value="clinical">clinical</option>
                <option value="synthetic">synthetic</option>
                <option value="deidentified">deidentified</option>
              </select>
            </label>
          )
        }
        if (key === 'gender') {
          return (
            <label key={key} className="patient-field" htmlFor={id}>
              <span>{label}</span>
              <select
                id={id}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              >
                <option value="">미기재 (서버 기본값)</option>
                <option value="male">남 (male)</option>
                <option value="female">여 (female)</option>
                <option value="other">기타 (other)</option>
                <option value="unspecified">미지정 (unspecified)</option>
              </select>
            </label>
          )
        }
        if (key === 'bloodType') {
          return (
            <label key={key} className="patient-field" htmlFor={id}>
              <span>{label}</span>
              <select
                id={id}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              >
                <option value="">선택 안 함</option>
                {BLOOD_OPTIONS.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </label>
          )
        }
        if (key === 'birthDate' || key === 'lastCheckupDate') {
          return (
            <label key={key} className="patient-field" htmlFor={id}>
              <span>{label}</span>
              <input
                id={id}
                type="date"
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </label>
          )
        }
        if (TEXTAREA_KEYS.has(key)) {
          return (
            <label key={key} className="patient-field full" htmlFor={id}>
              <span>{label}</span>
              <textarea
                id={id}
                rows={3}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </label>
          )
        }
        return (
          <label key={key} className="patient-field" htmlFor={id}>
            <span>{label}</span>
            <input
              id={id}
              type="text"
              value={form[key]}
              onChange={(e) => onChange(key, e.target.value)}
              autoComplete="off"
            />
          </label>
        )
      })}
    </div>
  )
}
