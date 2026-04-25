# 💰 Loan Tracker Pro (ระบบจัดการสินเชื่อ)

ระบบบริหารจัดการสินเชื่อ (Loan Management System) ที่ออกแบบมาเพื่อการใช้งานจริง ใช้งานง่าย รวดเร็ว และรองรับรูปแบบการปล่อยสินเชื่อที่หลากหลาย เช่น ดอกรายวัน ผ่อนรายสัปดาห์ ลดต้นลดดอก ฯลฯ

## ✨ ฟีเจอร์หลัก (Key Features)

### 📊 หน้า Dashboard อัจฉริยะ
*   สรุปภาพรวมพอร์ตสินเชื่อทั้งหมด
*   ยอดเงินต้นคงค้าง ดอกเบี้ยที่ได้รับ และรายการค้างส่ง
*   กราฟแท่งและกราฟวงกลมแสดงสัดส่วนการปล่อยกู้

### 📝 ระบบจัดการสินเชื่อครบวงจร
*   รองรับสินเชื่อหลายประเภท (ดอกรายวัน, ดอกหน้า, เงินก้อน+ดอก, ผ่อนรายอาทิตย์, ผ่อนรายเดือน, ลดต้นลดดอก)
*   คำนวณอัตราดอกเบี้ยได้ทั้งแบบ **เปอร์เซ็นต์ (%)** และ **จำนวนเงิน (บาท)**
*   ระบบปฏิทินที่ช่วยคำนวณวันครบกำหนดให้อัตโนมัติ (เลือกใส่วันที่ หรือ ใส่จำนวนวัน ก็ได้)
*   การแสดงตัวอย่างการคำนวณแบบละเอียด (Real-time Preview) ทันทีที่กรอกข้อมูล

### 📅 ตารางเช็คยอดรายวัน & LINE Report Generator (ฟีเจอร์เด่น)
*   สร้างตารางปฏิทิน 1-31 วัน เพื่อให้ "จิ้มเช็คยอด (Check-in)" ได้รวดเร็ว
*   สัญลักษณ์ 📍 (ไม่มีรายการ) และ ✅ (ส่งยอดแล้ว) ทำให้ดูง่าย
*   **ระบบสร้างรายงานส่งยอดอัตโนมัติ** คัดลอกไปวาง (Paste) สรุปยอดในกลุ่ม LINE ทุกๆ คืน 20.30 น. ได้ทันทีโดยไม่ต้องพิมพ์เอง

### 💳 ระบบบันทึกการชำระเงิน
*   บันทึกการรับเงินสด หรือ โอนเงิน
*   แยกการตัดเงินต้น และ ตัดดอกเบี้ย ให้อัตโนมัติ (สามารถปรับแก้ตัวเลขได้)
*   คำนวณยอดดอกเบี้ยคงค้างแบบ Real-time

### 🎨 ดีไซน์ระดับ Premium & ใช้งานง่าย (UI/UX)
*   ออกแบบในสไตล์แอปพลิเคชันพรีเมียม (Gold & Navy Theme)
*   **รองรับ Dark Mode 🌙 และ Light Mode ☀️ (แบบนวลตา ถนอมสายตา)**
*   Responsive Design ใช้งานได้ลื่นไหลทั้งบนคอมพิวเตอร์และมือถือ

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

*   **Frontend**: React (TypeScript), Vite
*   **Routing**: React Router DOM (HashRouter สำหรับ GitHub Pages)
*   **Styling**: Vanilla CSS (Custom Design System, CSS Variables)
*   **State Management**: Zustand
*   **Backend/Database**: Supabase (PostgreSQL) + Realtime Sync
*   **Deployment**: GitHub Pages (`gh-pages`)

## 🚀 วิธีการติดตั้งและการใช้งาน (Getting Started)

1. **Clone Repository**
   ```bash
   git clone https://github.com/project-sy789/Budget.git
   cd budget
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install
   ```

3. **ตั้งค่า Environment Variables**
   สร้างไฟล์ `.env.local` และใส่ค่า API Key ของ Supabase:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **รันโปรเจค (Development)**
   ```bash
   npm run dev
   ```

5. **การ Deploy ขึ้น GitHub Pages**
   ```bash
   npm run deploy
   ```

---
*ระบบนี้ถูกพัฒนาขึ้นเพื่อให้ครอบคลุมการทำงานแบบหน้างานจริง (Industry Standard Workflow) และลดภาระการทำบัญชีด้วยมือให้มากที่สุด*
