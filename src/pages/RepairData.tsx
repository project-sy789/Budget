import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

export default function RepairData() {
  const { fetchLoans, fetchPayments } = useStore()
  const [status, setStatus] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)

  const runRepair = async () => {
    if (!confirm('ยืนยันการซ่อมแซมข้อมูล? ข้อมูลการชำระเงินในอดีตจะถูกคำนวณสัดส่วนใหม่ทั้งหมดแบบ "ตัดต้นก่อน"')) return
    
    setIsRunning(true)
    setStatus('กำลังเริ่มการซ่อมแซม...')
    
    try {
      // 1. Fetch all loans
      const { data: loans, error: loanErr } = await supabase.from('loans').select('*')
      if (loanErr) throw loanErr
      if (!loans) return
      
      setTotal(loans.length)
      let count = 0
      
      for (const loan of loans) {
        setStatus(`กำลังซ่อมลูกหนี้: ${loan.borrower_name} (${count + 1}/${loans.length})`)
        
        // 2. Fetch all payments for this loan
        const { data: payments, error: payErr } = await supabase
          .from('payments')
          .select('*')
          .eq('loan_id', loan.id)
          .order('payment_date', { ascending: true })
          .order('created_at', { ascending: true })
          
        if (payErr) throw payErr
        if (!payments || payments.length === 0) {
          count++
          setProgress(Math.round((count / loans.length) * 100))
          continue
        }
        
        let remainingPrincipal = loan.principal
        
        for (const payment of payments) {
          // Calculate new split
          const p = Math.min(remainingPrincipal, payment.amount)
          const i = Math.max(0, payment.amount - p)
          
          // Only update if changed
          if (payment.principal_paid !== p || payment.interest_paid !== i) {
            const { error: updErr } = await supabase
              .from('payments')
              .update({ 
                principal_paid: p, 
                interest_paid: i 
              })
              .eq('id', payment.id)
            if (updErr) throw updErr
          }
          
          remainingPrincipal -= p
        }
        
        count++
        setProgress(Math.round((count / loans.length) * 100))
      }
      
      setStatus('✅ ซ่อมแซมข้อมูลเสร็จสมบูรณ์!')
      await fetchLoans()
      await fetchPayments()
      
    } catch (err: any) {
      console.error(err)
      setStatus(`❌ เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <h2>🛠️ เครื่องมือซ่อมแซมข้อมูลบัญชี</h2>
        <p>แก้ไขสัดส่วน "ต้น/ดอก" ในอดีตให้เป็นระบบตัดต้นก่อน 100%</p>
      </div>
      
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 20 }}>🏗️</div>
        <h3>ยินดีต้อนรับสู่ระบบซ่อมข้อมูล</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          ระบบจะทำการไล่ตรวจสอบทุกรายการชำระในอดีต และปรับให้เป็นการ "หักเงินต้นให้หมดก่อน" 
          เพื่อให้ยอดเงินต้นคงเหลือและดอกเบี้ยรับเป็นเลขกลมๆ และถูกต้องตามหลักที่พี่เจมต้องการ
        </p>
        
        {isRunning && (
          <div style={{ marginBottom: 20 }}>
            <div className="progress-bar" style={{ height: 12, marginBottom: 10 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 600 }}>{progress}%</div>
          </div>
        )}
        
        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 24, fontSize: '0.9rem' }}>
          {status || 'พร้อมดำเนินการ...'}
        </div>
        
        <button 
          className="btn btn-primary btn-lg" 
          onClick={runRepair}
          disabled={isRunning}
          style={{ width: '100%' }}
        >
          {isRunning ? 'กำลังซ่อมแซม...' : '🚀 เริ่มการซ่อมแซมข้อมูลทั้งหมด'}
        </button>
        
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.history.back()}>
            ← กลับไปหน้าหลัก
          </button>
        </div>
      </div>
      
      <div className="alert alert-warning" style={{ maxWidth: 600, margin: '20px auto' }}>
        ⚠️ <strong>คำแนะนำ:</strong> กรุณาอย่าปิดหน้านี้หรือรีเฟรชเบราว์เซอร์จนกว่าระบบจะทำงานเสร็จสิ้น เพื่อความสมบูรณ์ของข้อมูล
      </div>
    </div>
  )
}
