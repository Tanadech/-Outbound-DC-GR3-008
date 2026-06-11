# GR3-008 DC Report — วิธีคิดและ Logic

---

## 1. แหล่งข้อมูล (Data Sources)

| ไฟล์ | ชื่อใน config | หน้าที่ |
|------|--------------|--------|
| `data/data outbound dc.xlsx` | `FILES.main` | ข้อมูลหลัก — เอกสารขนส่งออกจาก DC ทุกใบ |
| `data/data outbound diff.xlsx` | `FILES.diff` | ข้อมูล Diff — รายการสินค้าที่ขาด/เกิน ระดับ SKU |
| `data/data.json` | `FILES.json` | ไฟล์ที่ถูก generate จากทั้ง 2 ไฟล์ข้างบน (ใช้บน GitHub Pages) |

### ที่มาของแต่ละไฟล์

**`data outbound dc.xlsx`**
Export จาก **WMS (C#)** เมนู **Report Outbound → Transaction Outbound Report**
ครอบคลุมทุกเอกสาร Outbound ที่ออกจาก DC

**`data outbound diff.xlsx`**
ดึงจาก **โปรแกรม GR3 (ข้อมูลหลังบ้าน)** โดย **พี่ฝน**
เป็นข้อมูลระดับ SKU ที่บันทึกความต่างของสินค้าแต่ละรายการ (ขาด/เกิน/ไม่มีในระบบ)

> `data.json` ถูกสร้างโดย `convert.js` และ push ขึ้น GitHub ผ่าน `update-data.bat`

---

## 2. คอลัมน์ที่ดึงจาก data outbound dc.xlsx

| ชื่อคอลัมน์ใน Excel | ชื่อ field ในระบบ | ความหมาย |
|--------------------|------------------|----------|
| เลขที่เอกสาร | `docNo` | รหัสเอกสารขนส่ง |
| ชื่อสาขา | `branch` | สาขาปลายทาง |
| วันที่คิวงาน | `queueDate` | วันที่กำหนดส่ง |
| ประตู T2 | `gateT2` | ประตูขาออก T2 |
| ประตู T3 | `gateT3` | ประตูขาออก T3 → ใช้ระบุคลัง WH1/WH2/WH3 |
| ผู้บันทึก T3 | `recT3` | ผู้บันทึกฝั่ง DC |
| ผู้บันทึกรับสินค้า | `recRecv` | คนรับสินค้าฝั่งสาขา |
| จำนวนกล่องสแกนส่ง | `scanSend` | กล่องที่สแกนส่งออก |
| จำนวนกล่องสแกนรับ | `scanRecv` | กล่องที่สแกนรับที่สาขา |
| จำนวนขาด | `scanShort` | กล่องขาด (ถ้าเป็น negative จะแปลงเป็น absolute) |
| จำนวนเกิน | `scanOver` | กล่องเกิน |
| R008 | `r008` | ผลการนับหยาบ: `ขาดจริง` / `ไม่ขาดได้ครบ` / `ออกแล้ว` |
| สาเหตุของ R008 | `r008Reason` | สาเหตุที่บันทึกใน R008 |
| ผู้บันทึก R008 | `r008Rec` | คนที่บันทึก R008 |
| วันที่บันทึก R008 | `r008Date` | วันที่บันทึก R008 |

---

## 3. คอลัมน์ที่ดึงจาก data outbound diff.xlsx

| ชื่อคอลัมน์ใน Excel | ชื่อ field ในระบบ | ความหมาย |
|--------------------|------------------|----------|
| outbound_docuno | `docNo` (key) | ใช้จับคู่กับเอกสารหลัก |
| product_code | `product` | รหัสสินค้า |
| barcode | `barcode` | บาร์โค้ด |
| diff_quantity | `diffQty` | จำนวน diff |
| reason | `reason` | สาเหตุ: มีคำว่า "ขาด" / "เกิน" / อื่นๆ |
| save_time | `saveTime` | วันเวลาที่บันทึก diff → ใช้เป็น `diffSaveTime` |
| employee_code | `empCode` | รหัสพนักงาน |
| employee_approve | `empApprove` | ผู้อนุมัติ |

---

## 4. การประมวลผลข้อมูล (Data Pipeline)

```
data outbound dc.xlsx          data outbound diff.xlsx
        ↓                               ↓
   allData (rows ทั้งหมด)      diffIndex (จับคู่ด้วย docNo)
        ↓                               ↓
        └──────── enrichRow() ──────────┘
                       ↓
             allData (enriched)
                       ↓
          filterShortageRecords()
                       ↓
           shortageData (scanShort > 0 หรือ scanOver > 0)
```

### field ที่คำนวณเพิ่ม (computed fields)

| field | วิธีคำนวณ |
|-------|----------|
| `warehouse` | ดึง prefix จาก gateT2 + gateT3 (ตัด suffix "-XX") เช่น "WH2-69" → "WH2" |
| `totalDiffShort` | sum ของ diffQty ที่ reason มีคำว่า "ขาด" |
| `totalDiffOver` | sum ของ diffQty ที่ reason มีคำว่า "เกิน" |
| `diffSaveTime` | `save_time` ที่เร็วที่สุดในกลุ่ม diff ของเอกสารนั้น |
| `diffItems` | array ของ diff items ทั้งหมดที่ตรงกับ docNo |

---

## 5. KPI Cards (แถวบนสุด)

| Card | ดึงจาก | เงื่อนไข |
|------|--------|---------|
| เอกสารที่มีขาด/เกิน | `shortageData` | `scanShort > 0` หรือ `scanOver > 0` |
| รายการสินค้าขาด | `diffRows` | แถวที่ reason มีคำว่า "ขาด" (นับจำนวนแถว) |
| รายการสินค้าเกิน | `diffRows` | แถวที่ reason มีคำว่า "เกิน" (นับจำนวนแถว) |
| ไม่มีข้อมูลในระบบ | `diffRows` | แถวที่ reason ไม่มีทั้ง "ขาด" และ "เกิน" |
| R008 — ขาดจริง | `shortageData` | `r008 === 'ขาดจริง'` |
| R008 — ไม่ขาดได้ครบ | `shortageData` | `r008 === 'ไม่ขาดได้ครบ'` |
| Diff รวมทั้งหมด | `diffRows` | นับแถวทั้งหมด (ทุก reason) |

---

## 6. Case Management Cards (4 ใบ)

### ต้องเคลียร์เคสภายในวัน
- **ดึงจาก:** `shortageData`
- **เงื่อนไข:** `diffSaveTime` ตรงกับวันปัจจุบัน
- **ความหมาย:** เอกสารที่มีขาด/เกิน ซึ่งมีคนบันทึก diff วันนี้ → ต้องเคลียร์ภายในวัน

### ยังไม่ได้เคลียร์
- **ดึงจาก:** `shortageData`
- **เงื่อนไข:** `r008 !== 'ไม่ขาดได้ครบ'`
- **ความหมาย:** เอกสารขาด/เกิน ที่ R008 ยังไม่ผ่าน (รวมทั้งที่ยังไม่มี R008, ขาดจริง, ออกแล้ว)

### รอเคลียร์เคส
- **ดึงจาก:** `shortageData`
- **เงื่อนไข:** `r008Reason` มีคำว่า `"กำลังตรวจสอบ"`
- **ความหมาย:** เอกสารที่ลงสาเหตุ R008 ว่ากำลังตรวจสอบอยู่

### เคลียร์เคสแล้ว *(คลิกได้)*
- **ดึงจาก:** `allData` (ทุกเอกสาร ไม่ใช่แค่ shortageData)
- **เงื่อนไข:** `r008Reason` มีค่า **AND** `scanShort === 0` **AND** `scanOver === 0`
- **ความหมาย:** เอกสารที่ตัวเลขขาด/เกิน = 0 แต่มีสาเหตุ R008 บันทึกไว้ (เคยมีปัญหาและถูกเคลียร์แล้ว)
- **คลิก:** popup ตารางรายการทั้งหมด

---

## 7. กราฟ เอกสารขาด/เกิน รายวัน

- **ดึงจาก:** `shortageData`
- **แกน X:** `queueDate` (วันที่คิวงาน) จัดกลุ่มรายวัน
- **แกน Y:** จำนวนเอกสารที่มีขาด/เกินในวันนั้น

---

## 8. ตารางสรุปตามสาขา (Branch Summary)

แต่ละแถว = 1 สาขา รวมข้อมูลจาก docs ทุกใบของสาขานั้น

| คอลัมน์ | ดึงจาก | วิธีคำนวณ |
|---------|--------|-----------|
| สาขา | `branch` | ชื่อสาขา |
| จำนวนเอกสาร | `shortageData` | นับ docs ของสาขา |
| WH1 | `warehouse` | นับ docs ที่ warehouse มีคำว่า "WH1" |
| WH2 | `warehouse` | นับ docs ที่ warehouse มีคำว่า "WH2" |
| WH3 | `warehouse` | นับ docs ที่ warehouse มีคำว่า "WH3" |
| รวมขาด (ชิ้น) | `totalDiffShort` หรือ `scanShort` | sum ของ `totalDiffShort > 0 ? totalDiffShort : scanShort` |
| รวมเกิน (ชิ้น) | `totalDiffOver` หรือ `scanOver` | sum ของ `totalDiffOver > 0 ? totalDiffOver : scanOver` |
| รวม Diff | `diffItems.length` | sum ของจำนวน diff items ทุก doc ในสาขา |
| วันล่าช้า | `diffSaveTime` | `diffSaveTime` ล่าสุด (ใหม่สุด) ในสาขา + badge อายุกี่วัน |
| บันทึก R008 | `r008Rec`, `r008Date`, `diffSaveTime` | นับ docs ที่มีทั้ง `r008Rec` **AND** `r008Date` **AND** `diffSaveTime` |
| ไม่บันทึก R008 | (complement) | นับ docs ที่ขาดอย่างใดอย่างหนึ่งข้างบน |

> หมายเหตุ: บันทึก R008 + ไม่บันทึก R008 = จำนวนเอกสาร เสมอ

**คลิกแถวสาขา** → popup รายการเอกสารทั้งหมดของสาขานั้น
**คลิกเอกสารใน popup** → detail modal รายละเอียดเอกสาร

---

## 9. ตาราง Popup รายเอกสาร (Branch Docs Modal)

เรียงตาม queueDate ล่าสุดก่อน คอลัมน์เหมือน data-table เดิม:

| คอลัมน์ | field | หมายเหตุ |
|---------|-------|---------|
| เลขที่เอกสาร | `docNo` | |
| วันที่คิว | `queueDate` | |
| คลัง | `warehouse` | คำนวณจาก gateT2 + gateT3 |
| ผู้บันทึก DC | `recT3` | ผู้บันทึก T3 |
| ผู้บันทึก สาขา | `recRecv` | ผู้บันทึกรับสินค้า |
| ขาด (ชิ้น) | `totalDiffShort` หรือ `scanShort` | ใช้ diff ถ้ามี ไม่งั้นใช้ scan |
| เกิน (ชิ้น) | `totalDiffOver` หรือ `scanOver` | ใช้ diff ถ้ามี ไม่งั้นใช้ scan |
| R008 | `r008` | |
| สาเหตุ R008 | `r008Reason` | |
| ผู้บันทึก R008 | `r008Rec` | |
| รายการ Diff | `diffItems.length` | จำนวน SKU ใน diff file |
| วันที่บันทึก Diff | `diffSaveTime` | วันแรกสุดที่บันทึก diff + อายุกี่วัน |

---

## 10. เงื่อนไข Badge สี (Age Badge)

| เงื่อนไข | Badge | ความหมาย |
|---------|-------|----------|
| ≤ 3 วัน | 🟢 สีเขียว | ยังสด |
| 4–7 วัน | 🟡 สีเหลือง | เริ่มช้า |
| > 7 วัน | 🔴 สีแดง | ล่าช้ามาก |

---

## 11. การอัพเดตข้อมูล

```
update-data.bat
    ↓
node convert.js          (Excel → data.json)
    ↓
git add data/data.json
    ↓
git commit + git push    (ขึ้น GitHub → GitHub Pages โหลดใหม่อัตโนมัติ)
    ↓
logs/update.log          (บันทึก log ทุกครั้ง)
```

> รัน `update-data.bat auto` ผ่าน Task Scheduler เพื่อให้อัพเดตอัตโนมัติโดยไม่มี popup
