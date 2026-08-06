/**
 * 薩提爾生命探索 - 簽到系統
 */

var SHEET_ID = 'INSERT_GOOGLE_SHEET_ID';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('薩提爾生命探索')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// 初始化
// ============================================================
function initSheets() {
  var ss = getSpreadsheet();
  var existing = ss.getSheets().map(function(s) { return s.getName(); });

  if (existing.indexOf('members') === -1) {
    var ws = ss.insertSheet('members');
    ws.appendRow(['帳號', '密碼', '姓名', '角色', '組別', '是否組長', '是否鎖定', '連續請假次數']);
    ws.appendRow(['admin', 'admin123', '管理員', 'admin', '', '否', '否', 0]);
  }
  if (existing.indexOf('courses') === -1) {
    var ws2 = ss.insertSheet('courses');
    ws2.appendRow(['課程ID', '日期', '時間', '類型', '地點', '狀態']);
  }
  if (existing.indexOf('attendance') === -1) {
    var ws3 = ss.insertSheet('attendance');
    ws3.appendRow(['課程ID', '帳號', '狀態', '時間戳記', '備註']);
  }
  return 'done';
}

// ============================================================
// 工具函式：讀取工作表為陣列（key 用英文）
// ============================================================
function readSheet(sheetName) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName(sheetName);
  if (!ws) return [];
  var data = ws.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      row.push(data[i][j]);
    }
    rows.push(row);
  }
  return rows;
}

// 成員欄位索引：0帳號 1密碼 2姓名 3角色 4組別 5是否組長 6是否鎖定 7連續請假次數
// 課程欄位索引：0課程ID 1日期 2時間 3類型 4地點 5狀態
// 出缺席欄位索引：0課程ID 1帳號 2狀態 3時間戳記 4備註

function formatDate(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return String(val || '');
}

function formatTime(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Taipei', 'HH:mm');
  }
  var s = String(val || '');
  if (s.length > 5) s = s.substring(0, 5);
  return s;
}

// ============================================================
// 登入
// ============================================================
function login(username, password) {
  var rows = readSheet('members');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]).trim() === String(username).trim()) {
      if (String(r[1]).trim() !== String(password).trim()) {
        return { ok: false, msg: '帳號或密碼錯誤' };
      }
      if (r[6] === '是') {
        return { ok: false, msg: '您的帳號已被鎖定，請聯繫管理員' };
      }
      return {
        ok: true,
        user: {
          username: String(r[0]).trim(),
          name: String(r[2]),
          role: String(r[3]),
          group: String(r[4] || ''),
          isLeader: r[5] === '是'
        }
      };
    }
  }
  return { ok: false, msg: '帳號或密碼錯誤' };
}

// ============================================================
// 儀表板
// ============================================================
function getDashboard(username) {
  try {
    var memberRows = readSheet('members');
    var member = null;
    for (var i = 0; i < memberRows.length; i++) {
      if (String(memberRows[i][0]).trim() === String(username).trim()) {
        member = memberRows[i];
        break;
      }
    }
    if (!member) return { ok: false };

    var courseRows = readSheet('courses');
    var attRows = readSheet('attendance');
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');

    // 格式化課程
    var courses = [];
    for (var c = 0; c < courseRows.length; c++) {
      courses.push({
        id: String(courseRows[c][0]),
        date: formatDate(courseRows[c][1]),
        time: formatTime(courseRows[c][2]),
        type: String(courseRows[c][3]),
        location: String(courseRows[c][4] || ''),
        status: String(courseRows[c][5] || 'upcoming')
      });
    }

    var todayCourses = courses.filter(function(c) { return c.date === today; });
    var upcomingCourses = courses.filter(function(c) {
      return c.date >= today && c.status !== 'ended';
    }).sort(function(a, b) { return a.date.localeCompare(b.date); });

    // 出缺席
    var myAtt = [];
    for (var a = 0; a < attRows.length; a++) {
      if (String(attRows[a][1]).trim() === String(username).trim()) {
        myAtt.push({
          courseId: String(attRows[a][0]),
          status: String(attRows[a][2])
        });
      }
    }

    // 分組
    var myGroup = String(member[4] || '');
    var groupMembers = [];
    if (myGroup) {
      for (var g = 0; g < memberRows.length; g++) {
        if (String(memberRows[g][4] || '') === myGroup) {
          groupMembers.push({
            name: String(memberRows[g][2]),
            isLeader: memberRows[g][5] === '是'
          });
        }
      }
    }

    var signed = 0, leaves = 0, absent = 0;
    for (var s = 0; s < myAtt.length; s++) {
      if (myAtt[s].status === '簽到') signed++;
      else if (myAtt[s].status === '請假') leaves++;
      else if (myAtt[s].status === '曠課') absent++;
    }

    return {
      ok: true,
      name: String(member[2]),
      role: String(member[3]),
      group: myGroup,
      isLeader: member[5] === '是',
      consecutiveLeaves: Number(member[7]) || 0,
      signed: signed,
      leaves: leaves,
      absent: absent,
      todayCourses: todayCourses,
      upcomingCourses: upcomingCourses,
      myAtt: myAtt,
      groupMembers: groupMembers
    };
  } catch (e) {
    Logger.log('getDashboard error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// 課程管理
// ============================================================
function getCourses() {
  var courseRows = readSheet('courses');
  var courses = [];
  for (var i = 0; i < courseRows.length; i++) {
    courses.push({
      id: String(courseRows[i][0]),
      date: formatDate(courseRows[i][1]),
      time: formatTime(courseRows[i][2]),
      type: String(courseRows[i][3]),
      location: String(courseRows[i][4] || ''),
      status: String(courseRows[i][5] || 'upcoming')
    });
  }
  // 按日期排序（新的在前）
  courses.sort(function(a, b) { return b.date.localeCompare(a.date) || b.time.localeCompare(a.time); });
  return courses;
}

function addCourse(dateStr, timeStr, courseType, location) {
  if (!dateStr || !timeStr || !courseType) return { ok: false, msg: '請填寫完整' };
  var id = 'C' + dateStr.replace(/-/g, '') + timeStr.replace(/:/g, '');
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('courses');
  if (!ws) {
    ws = ss.insertSheet('courses');
    ws.appendRow(['課程ID', '日期', '時間', '類型', '地點', '狀態']);
  }
  ws.appendRow([id, dateStr, timeStr, courseType, location || '', 'upcoming']);
  return { ok: true, msg: '課程已新增' };
}

function setCourseStatus(courseId, newStatus) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('courses');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId) {
      ws.getRange(i + 1, 6).setValue(newStatus);
      if (newStatus === 'ended') markAbsent(courseId);
      return { ok: true, msg: '已更新' };
    }
  }
  return { ok: false, msg: '找不到課程' };
}

function deleteCourse(courseId) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('courses');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId) {
      if (String(data[i][5]) !== 'upcoming') return { ok: false, msg: '只能刪除尚未開始的課程' };
      ws.deleteRow(i + 1);
      return { ok: true, msg: '已刪除' };
    }
  }
  return { ok: false, msg: '找不到' };
}

function updateCourseTime(courseId, newTime) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('courses');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId) {
      ws.getRange(i + 1, 3).setValue(newTime);
      return { ok: true, msg: '時間已更新' };
    }
  }
  return { ok: false, msg: '找不到' };
}

function updateCourseLocation(courseId, newLocation) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('courses');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId) {
      ws.getRange(i + 1, 5).setValue(newLocation);
      return { ok: true, msg: '地點已更新' };
    }
  }
  return { ok: false, msg: '找不到' };
}

// ============================================================
// 簽到 / 請假
// ============================================================
function signIn(courseId, username) {
  var course = findCourse(courseId);
  if (!course) return { ok: false, msg: '課程不存在' };
  if (course.status !== 'ongoing') return { ok: false, msg: '目前無法簽到' };
  if (hasRecord(courseId, username)) return { ok: false, msg: '已有紀錄' };
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('attendance');
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  ws.appendRow([courseId, username, '簽到', now, '']);
  return { ok: true, msg: '簽到成功' };
}

function requestLeave(courseId, username, reason) {
  var course = findCourse(courseId);
  if (!course) return { ok: false, msg: '課程不存在' };
  if (course.status !== 'upcoming') return { ok: false, msg: '上課後無法請假' };
  if (hasRecord(courseId, username)) return { ok: false, msg: '已有紀錄' };
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('attendance');
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  ws.appendRow([courseId, username, '請假', now, reason || '']);
  if (course.type === '實體') checkLock(username);
  return { ok: true, msg: '請假成功' };
}

function adminLeave(courseId, username, adminUser, reason) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('attendance');
  var data = ws.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var note = reason || '管理員' + adminUser + '協助請假';
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId && String(data[i][1]).trim() === username) {
      ws.getRange(i + 1, 3).setValue('請假');
      ws.getRange(i + 1, 5).setValue(note);
      found = true;
      // 解除曠課鎖定
      updateField('members', username, 6, '否');
      break;
    }
  }
  if (!found) {
    ws.appendRow([courseId, username, '請假', now, note]);
  }
  var course = findCourse(courseId);
  if (course && course.type === '實體') checkLock(username);
  return { ok: true, msg: '已為 ' + username + ' 請假' };
}

// ============================================================
// 出缺席查詢
// ============================================================
function getAtt(courseId) {
  var attRows = readSheet('attendance');
  var memberRows = readSheet('members');
  var results = [];
  for (var i = 0; i < attRows.length; i++) {
    if (String(attRows[i][0]) === courseId) {
      var uname = String(attRows[i][1]).trim();
      var name = uname;
      for (var m = 0; m < memberRows.length; m++) {
        if (String(memberRows[m][0]).trim() === uname) { name = String(memberRows[m][2]); break; }
      }
      results.push({
        username: uname,
        name: name,
        status: String(attRows[i][2]),
        time: String(attRows[i][3]),
        note: String(attRows[i][4] || '')
      });
    }
  }
  return results;
}

function changeAttStatus(courseId, username, newStatus) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('attendance');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === courseId && String(data[i][1]).trim() === String(username).trim()) {
      ws.getRange(i + 1, 3).setValue(newStatus);
      ws.getRange(i + 1, 5).setValue('管理員手動修改');
      // 如果改為曠課就鎖帳；如果從曠課改為其他就解鎖
      if (newStatus === '曠課') {
        updateField('members', username, 6, '是');
      } else {
        // 重新檢查是否需要鎖定
        updateField('members', username, 6, '否');
        checkLock(username);
      }
      return { ok: true, msg: '已更新為「' + newStatus + '」' };
    }
  }
  return { ok: false, msg: '找不到紀錄' };
}

// ============================================================
// 成員管理
// ============================================================
function getMembers() {
  var rows = readSheet('members');
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    list.push({
      username: String(rows[i][0]).trim(),
      name: String(rows[i][2]),
      role: String(rows[i][3]),
      group: String(rows[i][4] || ''),
      isLeader: rows[i][5] === '是',
      locked: rows[i][6] === '是',
      consecutiveLeaves: Number(rows[i][7]) || 0
    });
  }
  return list;
}

function addMember(username, password, name, role) {
  var rows = readSheet('members');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === username) return { ok: false, msg: '帳號已存在' };
  }
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('members');
  ws.appendRow([username, password, name, role, '', '否', '否', 0]);
  return { ok: true, msg: '已新增' };
}

function deleteMember(username) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('members');
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === username) {
      ws.deleteRow(i + 1);
      return { ok: true, msg: '已刪除' };
    }
  }
  return { ok: false, msg: '找不到' };
}

function unlockMember(username) {
  updateField('members', username, 6, '否');
  updateField('members', username, 7, 0);
  return { ok: true, msg: '已解鎖' };
}

// ============================================================
// 分組
// ============================================================
function saveGroups(data) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('members');
  var sheetData = ws.getDataRange().getValues();
  for (var d = 0; d < data.length; d++) {
    var uname = data[d].username;
    var group = data[d].group;
    var isLeader = data[d].isLeader;
    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]).trim() === uname) {
        ws.getRange(i + 1, 5).setValue(group);
        ws.getRange(i + 1, 6).setValue(isLeader ? '是' : '否');
        break;
      }
    }
  }
  return { ok: true, msg: '分組已儲存' };
}

// ============================================================
// 內部工具
// ============================================================
function findCourse(courseId) {
  var rows = readSheet('courses');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === courseId) {
      return {
        id: String(rows[i][0]),
        date: formatDate(rows[i][1]),
        time: formatTime(rows[i][2]),
        type: String(rows[i][3]),
        location: String(rows[i][4] || ''),
        status: String(rows[i][5] || 'upcoming')
      };
    }
  }
  return null;
}

function hasRecord(courseId, username) {
  var rows = readSheet('attendance');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === courseId && String(rows[i][1]).trim() === String(username).trim()) return true;
  }
  return false;
}

function updateField(sheet, username, colIdx, value) {
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName(sheet);
  var data = ws.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim()) {
      ws.getRange(i + 1, colIdx + 1).setValue(value);
      return;
    }
  }
}

function checkLock(username) {
  var attRows = readSheet('attendance');
  // 曠課一次就鎖（不分實體線上）
  for (var i = 0; i < attRows.length; i++) {
    if (String(attRows[i][1]).trim() === username && String(attRows[i][2]) === '曠課') {
      updateField('members', username, 6, '是');
      return;
    }
  }
  // 實體連續請假2次就鎖（線上不計）
  var courses = getCourses();
  var physical = courses.filter(function(c) { return c.type === '實體' && c.status === 'ended'; });
  physical.sort(function(a, b) { return b.date.localeCompare(a.date); });
  var consecutive = 0;
  for (var p = 0; p < physical.length; p++) {
    var found = false;
    for (var a = 0; a < attRows.length; a++) {
      if (String(attRows[a][0]) === physical[p].id && String(attRows[a][1]).trim() === username) {
        if (String(attRows[a][2]) === '請假') { consecutive++; found = true; }
        else { found = true; consecutive = 0; }
        break;
      }
    }
    if (!found) break;
    if (consecutive === 0) break;
  }
  updateField('members', username, 7, consecutive);
  if (consecutive >= 2) updateField('members', username, 6, '是');
}

function markAbsent(courseId) {
  var memberRows = readSheet('members');
  var attRows = readSheet('attendance');
  var recorded = [];
  for (var a = 0; a < attRows.length; a++) {
    if (String(attRows[a][0]) === courseId) recorded.push(String(attRows[a][1]).trim());
  }
  var ss = getSpreadsheet();
  var ws = ss.getSheetByName('attendance');
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  for (var i = 0; i < memberRows.length; i++) {
    var uname = String(memberRows[i][0]).trim();
    if (memberRows[i][3] === 'student' && memberRows[i][6] !== '是' && recorded.indexOf(uname) === -1) {
      ws.appendRow([courseId, uname, '曠課', now, '系統自動標記']);
      updateField('members', uname, 6, '是');
    }
  }
}
