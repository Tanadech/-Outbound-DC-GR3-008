/* ============================================================
   APP CONFIGURATION & CONSTANTS
   ============================================================ */
export const CONFIG = {
  FILES: {
    main: './data/data outbound dc.xlsx',
    diff: './data/data outbound diff.xlsx',
    json: './data/data.json',
  },

  /* ── Column header names (ชื่อจริงใน Excel)
     ระบบจะค้นหา index จากชื่อนี้อัตโนมัติ
     ถ้าข้อมูลใหม่มีคอลัมน์เพิ่ม/เรียงใหม่ → แก้แค่ตรงนี้ ──────── */
  COL_NAMES: {
    DOC_NO:      'เลขที่เอกสาร',
    QUEUE_NO:    'เลขที่คิวงาน',
    BRANCH:      'ชื่อสาขา',
    TRUCK_TYPE:  'ประเภทรถ',
    JOB_TYPE:    'ประเภทงาน',
    QUEUE_DATE:  'วันที่คิวงาน',
    TIME_SLOT:   'ช่วงเวลา',
    LICENSE:     'ป้ายทะเบียน',
    DRIVER:      'ชื่อคนขับ',
    PHONE:       'เบอร์โทร',
    GATE_T2:     'ประตู T2',
    GATE_T3:     'ประตู T3',
    TIME_T3:     'เวลา T3',
    ARRIVE_DATE: 'วันที่ถึงสาขา',
    REC_T3:      'ผู้บันทึก T3',
    REC_RECV:    'ผู้บันทึกรับสินค้า',
    SCAN_SEND:   'จำนวนกล่องสแกนส่ง',
    SCAN_RECV:   'จำนวนกล่องสแกนรับ',
    DIFF_SHORT:  'จำนวนขาด',
    DIFF_OVER:   'จำนวนเกิน',
    R008:        'R008(สแกนนับหยาบ)',
    R008_REASON: 'สาเหตุของ R008',
    R008_REC:    'ผู้บันทึกR008',
    R008_DATE:   'วันทีบันทึกR008',
  },

  DIFF_COL_NAMES: {
    DOC_NO:      'outbound_docuno',
    PRODUCT:     'product_code',
    BARCODE:     'barcode',
    DIFF_QTY:    'diff_quantity',
    REASON:      'reason',
    BRANCH_CODE: 'branch_code',
    BRANCH_NAME: 'branch_name',
    EMP_CODE:    'employee_code',
    SAVE_TIME:   'save_time',
    EMP_APPROVE: 'employee_approve',
    QUANTITY:    'quantity',
  },

  /* ── Fallback index (ใช้เมื่อหาชื่อ header ไม่เจอ) ─────────── */
  COL: {
    DOC_NO:       0,
    QUEUE_NO:     1,
    BRANCH:       4,
    TRUCK_TYPE:   5,
    JOB_TYPE:     6,
    QUEUE_DATE:   7,
    TIME_SLOT:    8,
    LICENSE:      9,
    DRIVER:       10,
    PHONE:        11,
    GATE_T2:      12,
    GATE_T3:      13,
    TIME_T3:      23,
    ARRIVE_DATE:  25,
    REC_T3:       28,
    REC_RECV:     30,
    SCAN_SEND:    36,
    SCAN_RECV:    37,
    DIFF_SHORT:   38,
    DIFF_OVER:    39,
    R008:         40,
    R008_REASON:  41,
    R008_REC:     42,
    R008_DATE:    43,
  },

  DIFF_COL: {
    DOC_NO:       0,
    PRODUCT:      1,
    BARCODE:      2,
    DIFF_QTY:     3,
    REASON:       4,
    BRANCH_CODE:  5,
    BRANCH_NAME:  6,
    EMP_CODE:     7,
    SAVE_TIME:    8,
    EMP_APPROVE:  9,
    QUANTITY:     10,
  },

  STATUS: {
    S0: { code: 's0', label: 'รอจัดสินค้า',          color: 'danger' },
    S1: { code: 's1', label: 'จัดสินค้าเรียบร้อย',   color: 'info'   },
    S2: { code: 's2', label: 'ประมวลผลผ่าน',          color: 'ok'     },
    S4: { code: 's4', label: 'ประมวลผลผิดพลาด',       color: 'purple' },
  },

  TIME_SLOTS: [
    '00.30-03.30', '08.30-10.30', '08.30-11.30', '10.30-12.30',
    '11.30-14.30', '13.30-15.30', '14.30-17.30', '15.30-17.30',
    '18.30-21.30', '21.30-00.30',
  ],

  PAGE_SIZE_OPTIONS: [25, 50, 100, 200],
  DEFAULT_PAGE_SIZE: 50,
};
