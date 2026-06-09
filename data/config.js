/* ============================================================
   APP CONFIGURATION & CONSTANTS
   ============================================================ */
export const CONFIG = {
  FILES: {
    main: './data/data outbound dc.xlsx',
    diff: './data/data outbound diff.xlsx',
  },

  /* Column index mappings for main xlsx sheet */
  COL: {
    DOC_NO:       0,   // เลขที่เอกสาร
    QUEUE_NO:     1,   // เลขที่คิวงาน
    BRANCH:       2,   // ชื่อสาขา
    TRUCK_TYPE:   3,   // ประเภทรถ
    JOB_TYPE:     4,   // ประเภทงาน
    QUEUE_DATE:   5,   // วันที่คิวงาน
    TIME_SLOT:    6,   // ช่วงเวลา
    LICENSE:      7,   // ป้ายทะเบียน
    DRIVER:       8,   // ชื่อคนขับ
    PHONE:        9,   // เบอร์โทร
    GATE_T2:      10,  // ประตู T2
    GATE_T3:      11,  // ประตู T3
    TIME_T3:      12,  // เวลา T3
    ARRIVE_DATE:  13,  // วันที่ถึงสาขา
    REC_T3:       14,  // ผู้บันทึก T3
    REC_RECV:     15,  // ผู้บันทึกรับสินค้า
    SCAN_SEND:    16,  // จำนวนกล่องสแกนส่ง
    SCAN_RECV:    17,  // จำนวนกล่องสแกนรับ
    DIFF_SHORT:   18,  // จำนวนขาด
    DIFF_OVER:    19,  // จำนวนเกิน
    R008:         20,  // R008 (สแกนนับหยาบ)
    R008_REASON:  21,  // สาเหตุของ R008
    R008_REC:     22,  // ผู้บันทึก R008
    R008_DATE:    23,  // วันที่บันทึก R008
  },

  /* Column index mappings for diff xlsx sheet */
  DIFF_COL: {
    DOC_NO:       0,   // outbound_docuno
    PRODUCT:      1,   // product_code
    BARCODE:      2,   // barcode
    DIFF_QTY:     3,   // diff_quantity
    REASON:       4,   // reason
    BRANCH_CODE:  5,   // branch_code
    BRANCH_NAME:  6,   // branch_name
    EMP_CODE:     7,   // employee_code
    SAVE_TIME:    8,   // save_time
    EMP_APPROVE:  9,   // employee_approve
    QUANTITY:     10,  // quantity
  },

  /* Status definitions — code maps to CSS class .status-pill.{code} */
  STATUS: {
    S0: { code: 's0', label: 'รอจัดสินค้า',          color: 'danger' },
    S1: { code: 's1', label: 'จัดสินค้าเรียบร้อย',   color: 'info'   },
    S2: { code: 's2', label: 'ประมวลผลผ่าน',          color: 'ok'     },
    S4: { code: 's4', label: 'ประมวลผลผิดพลาด',       color: 'purple' },
  },

  /* Time slot sort order for charts */
  TIME_SLOTS: [
    '00.30-03.30',
    '08.30-10.30',
    '08.30-11.30',
    '10.30-12.30',
    '11.30-14.30',
    '13.30-15.30',
    '14.30-17.30',
    '15.30-17.30',
    '18.30-21.30',
    '21.30-00.30',
  ],

  PAGE_SIZE_OPTIONS: [25, 50, 100, 200],
  DEFAULT_PAGE_SIZE: 50,
};
