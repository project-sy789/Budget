import React, { useState } from 'react'
import { login } from '../lib/auth'

interface Props { onLogin: () => void }

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login(password)
    if (ok) {
      onLogin()
    } else {
      setError('รหัสผ่านไม่ถูกต้อง')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="logo-big">💰</div>
          <h1>ระบบจัดการสินเชื่อ</h1>
          <p>บันทึกการปล่อยดอกเบี้ยเงินกู้</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">⚠️ {error}</div>}
          <div className="form-group">
            <label className="form-label">รหัสผ่าน</label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="ใส่รหัสผ่าน"
              autoFocus
            />
          </div>
          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || !password}
          >
            {loading ? <><span className="spinner" /> กำลังตรวจสอบ...</> : '🔓 เข้าสู่ระบบ'}
          </button>
        </form>

      </div>
    </div>
  )
}
