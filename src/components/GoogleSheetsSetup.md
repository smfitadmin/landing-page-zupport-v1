# การตั้งค่า Google Sheets สำหรับรับข้อมูลจากฟอร์ม

## ขั้นตอนที่ 1: สร้าง Google Sheets

1. เปิด Google Sheets ที่คุณแชร์: https://docs.google.com/spreadsheets/d/1VbJiIgNx2dL_B7U1BtldTSR3k-7_cF2UDrmzScRzG20/edit
2. ตั้งชื่อ Header ในแถวแรก (ถ้ายังไม่มี):
   - A1: `timestamp`
   - B1: `name`
   - C1: `company`
   - D1: `email`
   - E1: `phone`
   - F1: `role`
   - G1: `message`

## ขั้นตอนที่ 2: สร้าง Google Apps Script

1. ใน Google Sheets ที่คุณแชร์ ไปที่ `Extensions` > `Apps Script`
2. ลบโค้ดเดิมและใส่โค้ดนี้:

```javascript
function doPost(e) {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // เปิด Google Sheets ด้วย ID ที่กำหนด
    const sheet = SpreadsheetApp.openById('1VbJiIgNx2dL_B7U1BtldTSR3k-7_cF2UDrmzScRzG20').getActiveSheet();
    
    // รับข้อมูลจากฟอร์ม
    const data = e.parameter;
    
    // เพิ่มข้อมูลลงใน Sheet
    sheet.appendRow([
      new Date(), // timestamp
      data.name || '',
      data.company || '',
      data.email || '',
      data.phone || '',
      data.role || '',
      data.message || ''
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({result: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({result: 'error', error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle preflight OPTIONS request
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({result: 'success', method: 'GET'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Alternative function with better CORS handling
function doPost(e) {
  try {
    // เปิด Google Sheets ด้วย ID ที่กำหนด
    const sheet = SpreadsheetApp.openById('1VbJiIgNx2dL_B7U1BtldTSR3k-7_cF2UDrmzScRzG20').getActiveSheet();
    
    // รับข้อมูลจากฟอร์ม
    const data = e.parameter;
    
    // เพิ่มข้อมูลลงใน Sheet
    sheet.appendRow([
      new Date(), // timestamp
      data.name || '',
      data.company || '',
      data.email || '',
      data.phone || '',
      data.role || '',
      data.message || ''
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({result: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({result: 'error', error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## ขั้นตอนที่ 3: Deploy Apps Script

1. คลิก `Deploy` > `New deployment`
2. เลือก type เป็น `Web app`
3. ตั้งค่า:
   - Execute as: `Me`
   - Who has access: `Anyone`
4. คลิก `Deploy`
5. คัดลอก URL ที่ได้

## ขั้นตอนที่ 4: อัพเดท URL ในโค้ด

ใน `src/App.tsx` แทนที่:
```javascript
const scriptURL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
```

ด้วย URL ที่ได้จาก Apps Script

## ขั้นตอนที่ 5: ทดสอบ

1. ลองกรอกฟอร์มและส่ง
2. ตรวจสอบว่าข้อมูลเข้า Google Sheets หรือไม่

## หมายเหตุ

- ข้อมูลจะถูกเก็บพร้อม timestamp
- สามารถเพิ่ม validation หรือ formatting ได้ใน Apps Script
- ควรตั้งค่า permissions ให้เหมาะสมเพื่อความปลอดภัย