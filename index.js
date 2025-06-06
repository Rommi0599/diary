// 引入必要的模組
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// 建立 Express 應用程式實例
const app = express();
const port = 3000;

// 解析 JSON 格式的請求主體
app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));

// 構建數據庫文件的路徑
const dbPath = path.join(__dirname, 'diary.db');

// 建立 SQLite 連線
const db = new sqlite3.Database(dbPath);

//
// ===== 管理員相關 =====
//

// 管理員後台頁面
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// 取得所有管理員資料
app.get('/users', (req, res) => {  
    // 從 admin 資料表中查詢所有管理員的 id、帳號、建立時間、是否為管理者
  db.all('SELECT id, username, created_at, is_admin FROM admin', (err, rows) => {
    if (err) {
      console.error('查詢錯誤:', err);
      // 查詢失敗時，回傳 500 錯誤
      return res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
    // 查詢成功，回傳管理員清單
    res.json({ success: true, users: rows });
  });
});


// 新增管理員
app.post('/addUser', async (req, res) => {
  //從前端取得新增管理員的資料（帳號、密碼雜湊、是否為管理員）
  const newUser = req.body;
  const hash = await bcrypt.hash(newUser.password_hash, 10);
  const query = 'INSERT INTO admin (username, password_hash, is_admin) VALUES (?, ?, ?)';
  const values = [newUser.username, hash, newUser.is_admin || 0];
  db.run(query, values, function (err) {
    if (err) {
      // 新增失敗時，印出錯誤並回傳失敗訊息
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      // 新增成功，回傳成功訊息與該管理員的 ID
      res.json({ success: true, message: 'User added successfully.', id: this.lastID });
    }
  });
});

// 刪除管理員
app.delete('/user/:id', (req, res) => {
  const id = req.params.id;  // 從路由參數中取得要刪除的管理員 ID
  db.run('DELETE FROM admin WHERE id = ?', [id], function (err) {
    // 刪除失敗，回傳錯誤訊息
    if (err) return res.json({ success: false, message: '刪除失敗' });
    // 刪除成功，回傳成功結果
    res.json({ success: true });
  });
});

// 修改管理員
app.put('/user/:id', async (req, res) => {
  const id = req.params.id;  // 從網址參數中取得要修改的管理員 ID
  const { password_hash, is_admin } = req.body;  // 從請求中取得要修改的欄位
  if (password_hash !== undefined) {
    // 密碼需進行雜湊
    const hash = await bcrypt.hash(password_hash, 10);
    db.run('UPDATE admin SET password_hash = ? WHERE id = ?', [hash, id], function (err) {
      if (err) return res.json({ success: false, message: '修改失敗' });
      res.json({ success: true });
    });
  } else if (is_admin !== undefined) {
    // 若有提供管理員權限變更，則只更新 is_admin 欄位
    db.run('UPDATE admin SET is_admin = ? WHERE id = ?', [is_admin, id], function (err) {
      if (err) return res.json({ success: false, message: '修改失敗' });
      res.json({ success: true });
    });
  } else {
    // 若沒有提供要修改的資料，回傳錯誤訊息
    res.json({ success: false, message: '未指定修改內容' });
  }
});

//
// ===== 登入/登出 =====
//

// 登入驗證（回傳 is_admin）
// 用戶傳送帳號密碼後，系統會查詢是否存在該用戶，並回傳登入狀態與權限資訊
app.post('/login', (req, res) => {
  const { username, password } = req.body;  // 從前端取得輸入的帳號與密碼
  // SQL 指令：查詢 admin 表格中是否存在該帳號
  const sql = 'SELECT * FROM admin WHERE username = ?';
  db.get(sql, [username], async (err, user) => {
    if (err) {
      // 資料庫錯誤，回傳 500 伺服器錯誤
      res.status(500).json({ success: false, message: '伺服器錯誤' });
    } else if (user && await bcrypt.compare(password, user.password_hash)) {
      // 查詢成功且密碼驗證通過，回傳登入成功與用戶資訊（包含是否為管理員 is_admin）
      res.json({ success: true, message: '登入成功', user_id: user.id, username: user.username, is_admin: user.is_admin });
    } else {
      // 查無此帳號或密碼錯誤
      res.json({ success: false, message: '帳號或密碼錯誤' });
    }
  });
});

//
// ===== 部落格相關 =====
//

// 新增部落格文章
app.post('/addBlog', (req, res) => {
  // 從前端取得使用者 ID 及部落格內容欄位
  const { user_id, title, category, tags, cover_url, summary, content } = req.body;
  // SQL 指令：插入新文章到 blogs 表格
  const sql = `INSERT INTO blogs (user_id, title, category, tags, cover_url, summary, content)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  // 執行 SQL 指令，將資料插入到資料庫中
  db.run(sql, [user_id, title, category, tags, cover_url, summary, content], function (err) {
    if (err) {
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      // 新增成功，回傳成功訊息與新文章的 ID
      res.json({ success: true, message: '新增成功', id: this.lastID });
    }
  });
});

// 取得所有部落格文章（含作者名稱）
app.get('/blogs', (req, res) => {
  db.all(
    `SELECT blogs.*, admin.username 
     FROM blogs 
     LEFT JOIN admin ON blogs.user_id = admin.id 
     ORDER BY blogs.created_at DESC`,  // 依建立時間新到舊排序
    (err, rows) => {
      if (err) {
        // 查詢錯誤時回傳空陣列
        res.status(500).json({ blogs: [] });
      } else {
        // 查詢成功，回傳所有部落格文章與作者名稱
        res.json({ blogs: rows });
      }
    }
  );
});

// 刪除部落格文章
app.delete('/blog/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得文章 ID
   // 執行刪除文章指令
  db.run('DELETE FROM blogs WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false });  // 刪除失敗，回傳錯誤訊息
    res.json({ success: true });  // 刪除成功，回傳成功訊息
  });
});

// 編輯部落格文章
app.put('/blog/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得文章 ID
  const { title, category, tags, cover_url, summary, content } = req.body;
  // 執行更新指令
  db.run(
    `UPDATE blogs SET title=?, category=?, tags=?, cover_url=?, summary=?, content=? WHERE id=?`,
    [title, category, tags, cover_url, summary, content, id],
    function (err) {
      if (err) return res.json({ success: false });  // 更新失敗，回傳錯誤訊息
      res.json({ success: true });  // 更新成功，回傳成功訊息
    }
  );
});

//
// ===== 日記相關 =====
//

// 新增日記
app.post('/addDiary', (req, res) => {
  // 從前端取得日記內容欄位
  const { user_id, date, mood_score, mood_describe, content } = req.body;
  // SQL 指令：插入新日記到 diaries 表格
  const sql = `INSERT INTO diaries (user_id, date, mood_score, mood_describe, content)
               VALUES (?, ?, ?, ?, ?)`;
  // 執行 SQL 指令，將資料插入到資料庫中
  db.run(sql, [user_id, date, mood_score, mood_describe, content], function (err) {
    if (err) {
      // 如果有錯誤，回傳 500 錯誤與失敗訊息
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      // 新增成功，回傳成功訊息與新日記的 ID
      res.json({ success: true, message: '新增成功', id: this.lastID });
    }
  });
});

// 取得所有日記
app.get('/diaries', (req, res) => {
  const user_id = req.query.user_id;  // 從查詢參數取得使用者 ID
  // SQL 指令：查詢指定使用者的所有日記，依日期降序排列
  db.all('SELECT * FROM diaries WHERE user_id = ? ORDER BY date DESC', [user_id], (err, rows) => {
    if (err) {
      // 如果有錯誤，回傳 500 錯誤與空日記陣列
      res.status(500).json({ diaries: [] });
    } else {
      // 查詢成功，回傳所有日記
      res.json({ diaries: rows });
    }
  });
});

// 刪除日記
app.delete('/diary/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得日記 ID
  // 執行刪除日記指令
  db.run('DELETE FROM diaries WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false });  // 刪除失敗，回傳錯誤訊息
    res.json({ success: true });  // 刪除成功，回傳成功訊息
  });
});

// 編輯日記內容
app.put('/diary/:id', (req, res) => {
  const id = req.params.id;   // 從網址參數取得日記 ID
  const { content } = req.body;  // 從請求中取得要修改的內容
  // 執行更新日記內容指令
  db.run('UPDATE diaries SET content = ? WHERE id = ?', [content, id], function (err) {
    if (err) return res.json({ success: false });  // 更新失敗，回傳錯誤訊息
    res.json({ success: true });  // 更新成功，回傳成功訊息
  });
});

//
// ===== 留言相關 =====
//

// 新增留言
app.post('/addComment', (req, res) => {
  // 從前端取得留言的部落格 ID、使用者 ID 及留言內容
  const { blog_id, user_id, content } = req.body;
  // SQL 指令：插入新留言到 comments 表格
  db.run(
    `INSERT INTO comments (blog_id, user_id, content) VALUES (?, ?, ?)`,
    [blog_id, user_id, content],
    function (err) {
      // 若新增過程發生錯誤，回傳失敗訊息
      if (err) return res.json({ success: false });
      // 新增成功，回傳成功訊息與新留言的 ID
      res.json({ success: true, id: this.lastID });
    }
  );
});

// 取得留言
app.get('/comments', (req, res) => {
  const blog_id = req.query.blog_id;  // 從查詢參數取得部落格文章ID
  // SQL 指令：查詢指定部落格文章的所有留言，並連接admin表以取得使用者名稱
  db.all(
    `SELECT comments.*, admin.username FROM comments LEFT JOIN admin ON comments.user_id = admin.id WHERE blog_id = ? ORDER BY created_at ASC`,
    [blog_id],
    (err, rows) => {
      // 如果查詢過程發生錯誤，回傳空留言陣列
      if (err) return res.json({ comments: [] });
      // 查詢成功，回傳所有留言與使用者名稱
      res.json({ comments: rows });
    }
  );
});

// 監聽應用程式的 exit 事件，在應用程式結束時關閉 SQLite 連線
process.on('exit', () => {
  db.close(() => {
    console.log('SQLite connection closed');
  });
});

// 啟動伺服器監聽指定埠號
app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});