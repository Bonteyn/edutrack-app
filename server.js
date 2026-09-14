const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const DB_FILE = path.join(__dirname, 'database.json');

// Чтение БД с инициализацией учетных данных админа по умолчанию
const readDB = () => {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    let updated = false;

    if (!data.sections) {
        data.sections = [
            { id: 'olympiads', name: 'Olimpiadalar' },
            { id: 'languages', name: "Til o'rganish" }
        ];
        updated = true;
    }

    if (!data.admin) {
        data.admin = { email: 'admin@edutrack.uz', password: 'admin12345' };
        updated = true;
    }

    if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
    return data;
};

const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');

app.get('/api/data', (req, res) => {
    const db = readDB();
    res.json({
        olympiads: db.olympiads,
        sections: db.sections
    });
});

app.get('/api/admin/stats', (req, res) => {
    const db = readDB();
    res.json({ totalUsers: db.users.length });
});

// Добавление раздела
app.post('/api/admin/add-section', (req, res) => {
    const { name, adminEmail } = req.body;
    const db = readDB();
    if (adminEmail !== db.admin.email) return res.status(403).json({ error: "Ruxsat yo'q!" });
    
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    db.sections.push({ id, name });
    writeDB(db);
    res.json({ success: true, sections: db.sections });
});

// Удаление раздела
app.post('/api/admin/delete-section', (req, res) => {
    const { id, adminEmail } = req.body;
    const db = readDB();
    if (adminEmail !== db.admin.email) return res.status(403).json({ error: "Ruxsat yo'q!" });

    db.sections = db.sections.filter(s => s.id !== id);
    const fallbackId = db.sections.length > 0 ? db.sections[0].id : 'olympiads';
    db.olympiads.forEach(item => {
        if (item.sectionId === id) item.sectionId = fallbackId;
    });

    writeDB(db);
    res.json({ success: true, sections: db.sections });
});

// Обновление логина и пароля админа
app.post('/api/admin/update-credentials', (req, res) => {
    const { currentEmail, newEmail, newPassword } = req.body;
    const db = readDB();

    if (currentEmail !== db.admin.email) {
        return res.status(403).json({ error: "Ruxsat yo'q!" });
    }

    if (!newEmail || !newPassword) {
        return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    db.admin.email = newEmail.trim();
    db.admin.password = newPassword.trim();
    writeDB(db);

    res.json({ success: true, newEmail: db.admin.email });
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();

    if (email.toLowerCase() === db.admin.email.toLowerCase()) {
        return res.status(400).json({ error: "Ushbu email band!" });
    }

    const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
        return res.status(400).json({ error: "Ushbu email allaqachon ro'yxatdan o'tgan!" });
    }

    const newUser = { id: Date.now(), email, password, role: 'user' };
    db.users.push(newUser);
    writeDB(db);

    res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();

    // Проверка админа
    if (email.toLowerCase() === db.admin.email.toLowerCase() && password === db.admin.password) {
        return res.json({ success: true, user: { email: db.admin.email, role: 'admin' } });
    }

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "Email yoki parol noto'g'ri!" });
    }

    res.json({ success: true, user });
});

app.post('/api/admin/upload-pdf', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fayl yuklanmadi!" });
    res.json({ pdf_url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/save-olympiad', (req, res) => {
    const { id, sectionId, adminEmail, title, category, tags, deadline, youtube_urls, extra_resources, pdf_url, description } = req.body;
    const db = readDB();
    if (adminEmail !== db.admin.email) return res.status(403).json({ error: "Ruxsat yo'q!" });

    const itemData = { 
        id: id ? Number(id) : Date.now(), 
        sectionId: sectionId || 'olympiads',
        title, category, tags, deadline, youtube_urls, extra_resources, pdf_url, description 
    };

    if (id) {
        const index = db.olympiads.findIndex(o => o.id == id);
        if (index !== -1) db.olympiads[index] = itemData;
    } else {
        db.olympiads.push(itemData);
    }
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/admin/delete-olympiad', (req, res) => {
    const { id, adminEmail } = req.body;
    const db = readDB();
    if (adminEmail !== db.admin.email) return res.status(403).json({ error: "Ruxsat yo'q!" });

    db.olympiads = db.olympiads.filter(o => o.id != id);
    writeDB(db);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
