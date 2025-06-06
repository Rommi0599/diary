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
// ===== 使用者與管理員相關 =====
//

// 管理員後台頁面
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// 取得所有使用者資料
app.get('/users', (req, res) => {  
    // 從admin查詢使用者
  db.all('SELECT id, username, created_at, is_admin FROM admin', (err, rows) => {
    if (err) {
      console.error('查詢錯誤:', err);
      return res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
    res.json({ success: true, users: rows });
  });
});


// 新增使用者
app.post('/addUser', async (req, res) => {
  //從前端取得新增使用者的資料（帳號、密碼雜湊、是否為管理員）
  const newUser = req.body;
  const hash = await bcrypt.hash(newUser.password_hash, 10);// 將密碼雜湊處理
  // 檢查是否提供了帳號和密碼
  const query = 'INSERT INTO admin (username, password_hash, is_admin) VALUES (?, ?, ?)';
  const values = [newUser.username, hash, newUser.is_admin || 0];
  db.run(query, values, function (err) {
    if (err) {
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      res.json({ success: true, message: '使用者新增成功', id: this.lastID });
    }
  });
});

// 刪除管理員
app.delete('/user/:id', (req, res) => {
  const id = req.params.id;  // 從路由參數中取得要刪除的管理員 ID
  db.run('DELETE FROM admin WHERE id = ?', [id], function (err) { 
    if (err) return res.json({ success: false, message: '刪除失敗' });
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
    res.json({ success: false, message: '未指定修改內容' });
  }
});

//
// ===== 登入/登出 =====
//

// 登入驗證（回傳 is_admin）
app.post('/login', (req, res) => {
  const { username, password } = req.body;  // 從前端取得輸入的帳號與密碼
  const sql = 'SELECT * FROM admin WHERE username = ?';
  db.get(sql, [username], async (err, user) => {
    if (err) {
      res.status(500).json({ success: false, message: '伺服器錯誤' });  
    } else if (user && await bcrypt.compare(password, user.password_hash)) {
      res.json({ success: true, message: '登入成功', user_id: user.id, username: user.username, is_admin: user.is_admin });
    } else {
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
  const sql = `INSERT INTO blogs (user_id, title, category, tags, cover_url, summary, content)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [user_id, title, category, tags, cover_url, summary, content], function (err) {
    if (err) {
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      res.json({ success: true, message: '新增成功', id: this.lastID });
    }
  });
});

// 取得所有部落格文章
app.get('/blogs', (req, res) => {

  db.all(
    `SELECT blogs.*, admin.username 
     FROM blogs 
     LEFT JOIN admin ON blogs.user_id = admin.id 
     ORDER BY blogs.created_at DESC`,  // 依建立時間新到舊排序
    (err, rows) => {
      if (err) {
        res.status(500).json({ blogs: [] });
      } else {
        res.json({ blogs: rows });
      }
    }
  );
});

// 刪除部落格文章
app.delete('/blog/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得文章 ID
  db.run('DELETE FROM blogs WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false }); 
    res.json({ success: true }); 
  });
});

// 編輯部落格文章
app.put('/blog/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得文章 ID
  const { title, category, tags, cover_url, summary, content } = req.body;
  db.run(
    `UPDATE blogs SET title=?, category=?, tags=?, cover_url=?, summary=?, content=? WHERE id=?`,
    [title, category, tags, cover_url, summary, content, id],
    function (err) {
      if (err) return res.json({ success: false });  
      res.json({ success: true }); 
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
  const sql = `INSERT INTO diaries (user_id, date, mood_score, mood_describe, content)
               VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [user_id, date, mood_score, mood_describe, content], function (err) {
    if (err) {
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
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
      res.status(500).json({ diaries: [] });
    } else {
      res.json({ diaries: rows });
    }
  });
});

// 刪除日記
app.delete('/diary/:id', (req, res) => {
  const id = req.params.id;  // 從網址參數取得日記 ID
  db.run('DELETE FROM diaries WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false }); 
    res.json({ success: true }); 
  });
});

// 編輯日記內容
app.put('/diary/:id', (req, res) => {
  const id = req.params.id;   // 從網址參數取得日記 ID
  const { content } = req.body;  // 從請求中取得要修改的內容
  db.run('UPDATE diaries SET content = ? WHERE id = ?', [content, id], function (err) {
    if (err) return res.json({ success: false }); 
    res.json({ success: true }); 
  });
});

//
// ===== 留言相關 =====
//

// 新增留言
app.post('/addComment', (req, res) => {
  // 從前端取得留言的部落格 ID、使用者 ID 及留言內容
  const { blog_id, user_id, content } = req.body;
  db.run(
    `INSERT INTO comments (blog_id, user_id, content) VALUES (?, ?, ?)`,
    [blog_id, user_id, content],
    function (err) {
      if (err) return res.json({ success: false });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// 取得留言
app.get('/comments', (req, res) => {
  const blog_id = req.query.blog_id;  // 從查詢參數取得部落格文章ID
  // 查詢留言，並連接admin表以取得使用者名稱
  db.all(
    `SELECT comments.*, admin.username FROM comments LEFT JOIN admin ON comments.user_id = admin.id WHERE blog_id = ? ORDER BY created_at ASC`,
    [blog_id],
    (err, rows) => {
      if (err) return res.json({ comments: [] });
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