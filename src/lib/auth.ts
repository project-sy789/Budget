// SHA-256 hash via Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const SESSION_KEY = 'loan_app_auth'
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8 hours

export async function login(password: string): Promise<boolean> {
  const storedHash = import.meta.env.VITE_APP_PASSWORD_HASH || ''
  if (!storedHash) {
    // No hash set yet — accept any password (first-run mode)
    setSession()
    return true
  }
  const inputHash = await sha256(password)
  if (inputHash === storedHash) {
    setSession()
    return true
  }
  return false
}

function setSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }))
}

export function isLoggedIn(): boolean {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return false
  try {
    const { ts } = JSON.parse(raw)
    return Date.now() - ts < SESSION_TTL
  } catch {
    return false
  }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
