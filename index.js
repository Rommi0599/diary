// 引入必要的模組
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

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

// GET 使用者頁面
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'user.html'));
});

// 取得所有使用者資料
app.get('/users', (req, res) => {
  db.all('SELECT id, username, created_at FROM users', (err, rows) => {
    if (err) {
      console.error('查詢錯誤:', err);
      return res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
    res.json({ success: true, users: rows });
  });
});

// 新增使用者
app.post('/addUser', (req, res) => {
  const newUser = req.body;
  const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
  const values = [newUser.username, newUser.password_hash];
  db.run(query, values, function (err) {
    if (err) {
      console.error('Error adding user to SQLite:', err);
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      res.json({ success: true, message: 'User added successfully.', id: this.lastID });
    }
  });
});

// 新增部落格文章
app.post('/addBlog', (req, res) => {
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

// 取得所有部落格文章（含作者名稱）
app.get('/blogs', (req, res) => {
  db.all(
    `SELECT blogs.*, users.username 
     FROM blogs 
     LEFT JOIN users ON blogs.user_id = users.id 
     ORDER BY blogs.created_at DESC`,
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
  const id = req.params.id;
  db.run('DELETE FROM blogs WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

// 編輯部落格文章
app.put('/blog/:id', (req, res) => {
  const id = req.params.id;
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

// 新增日記
app.post('/addDiary', (req, res) => {
  const { user_id, date, mood_score, mood_emoji, content } = req.body;
  const sql = `INSERT INTO diaries (user_id, date, mood_score, mood_emoji, content)
               VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [user_id, date, mood_score, mood_emoji, content], function (err) {
    if (err) {
      res.status(500).json({ success: false, message: '新增失敗' });
    } else {
      res.json({ success: true, message: '新增成功', id: this.lastID });
    }
  });
});

// 取得所有日記
app.get('/diaries', (req, res) => {
  const user_id = req.query.user_id;
  db.all('SELECT * FROM diaries WHERE user_id = ? ORDER BY date DESC', [user_id], (err, rows) => {
    if (err) {
      res.status(500).json({ diaries: [] });
    } else {
      res.json({ diaries: rows });
    }
  });
});

// 登入驗證
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username = ? AND password_hash = ?';
  db.get(sql, [username, password], (err, user) => {
    if (err) {
      res.status(500).json({ success: false, message: '伺服器錯誤' });
    } else if (user) {
      res.json({ success: true, message: '登入成功', user_id: user.id });
    } else {
      res.json({ success: false, message: '帳號或密碼錯誤' });
    }
  });
});

// 刪除日記
app.delete('/diary/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM diaries WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

// 編輯日記內容
app.put('/diary/:id', (req, res) => {
  const id = req.params.id;
  const { content } = req.body;
  db.run('UPDATE diaries SET content = ? WHERE id = ?', [content, id], function (err) {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

// 刪除使用者
app.delete('/user/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.json({ success: false, message: '刪除失敗' });
    res.json({ success: true });
  });
});

// 修改使用者（只改密碼為例）
app.put('/user/:id', (req, res) => {
  const id = req.params.id;
  const { password_hash } = req.body;
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id], function (err) {
    if (err) return res.json({ success: false, message: '修改失敗' });
    res.json({ success: true });
  });
});

// 新增留言
app.post('/addComment', (req, res) => {
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
  const blog_id = req.query.blog_id;
  db.all(
    `SELECT comments.*, users.username FROM comments LEFT JOIN users ON comments.user_id = users.id WHERE blog_id = ? ORDER BY created_at ASC`,
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