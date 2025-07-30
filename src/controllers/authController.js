// src/controllers/authController.js
// HTTP isteklerini işleyen ana mantık fonksiyonlarını (örneğin kullanıcı kayıt, giriş, URL kısaltma gibi) içerecek.

require('dotenv').config(); // .env dosyasındaki değişkenlere bu dosya içinden erişmek için

const pool = require('../config/db');     // Veritabanı bağlantı havuzunu alıyoruz
const bcrypt = require('bcryptjs');       // Şifreleri hashlemek için
const jwt = require('jsonwebtoken');      // JWT (JSON Web Token) oluşturmak ve doğrulamak için

// .env dosyasından JWT gizli anahtarını alıyoruz
const JWT_SECRET = process.env.JWT_SECRET; 

// JWT_SECRET'ın uygulamanın çalışması için tanımlı olması kritik.
// Tanımlı değilse, bir hata mesajı gösterip uygulamayı kapatırız.
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); // JWT_SECRET olmadan uygulama başlatılamaz
}

// --- Kullanıcı Kayıt İşlemi (POST /register) ---
// Bu fonksiyon, yeni bir kullanıcı kaydı oluşturma isteğini işler.
const registerUser = async (req, res, body) => {
    let client; // Veritabanı bağlantı nesnesi için bir yer tutucu
    try {
        // İsteğin body'sinden gelen JSON verisini ayrıştırıyoruz.
        // username, email ve password bilgilerini çıkarıyoruz.
        const { username, email, password } = JSON.parse(body);

        // --- 1. Temel Giriş Doğrulaması ---
        // Gerekli alanların boş olup olmadığını kontrol ediyoruz.
        if (!username || !email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request
            res.end(JSON.stringify({ error: 'Kullanıcı adı, e-posta ve şifre gerekli.' }));
            return; // İşlemi burada sonlandır
        }

        // E-posta formatının geçerli olup olmadığını basit bir regex ile kontrol ediyoruz.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); // 400 Bad Request
            res.end(JSON.stringify({ error: 'Geçersiz e-posta formatı.' }));
            return; // İşlemi burada sonlandır
        }

        // --- 2. Veritabanı Bağlantısı ve Mevcut Kullanıcı Kontrolü ---
        client = await pool.connect(); // Veritabanı bağlantı havuzundan bir istemci al

        // Aynı kullanıcı adı veya e-posta ile başka bir kullanıcı var mı diye kontrol et.
        const checkUserQuery = 'SELECT id FROM users WHERE username = $1 OR email = $2';
        const checkUserResult = await client.query(checkUserQuery, [username, email]);

        if (checkUserResult.rows.length > 0) {
            res.writeHead(409, { 'Content-Type': 'application/json' }); // 409 Conflict (Çakışma)
            res.end(JSON.stringify({ error: 'Kullanıcı adı veya e-posta zaten kullanımda.' }));
            return; // İşlemi burada sonlandır
        }

        // --- 3. Şifreyi Hash'leme ---
        // Şifrenin güvenli bir şekilde saklanması için hash'leme işlemi.
        // `genSalt(10)`: 10 tur gücünde bir tuz (salt) oluşturur. Tuz, aynı şifrenin farklı hash'ler üretmesini sağlar.
        const salt = await bcrypt.genSalt(10); 
        // `hash(password, salt)`: Kullanıcının şifresini ve tuzu kullanarak şifreyi hash'ler.
        const passwordHash = await bcrypt.hash(password, salt);

        // --- 4. Kullanıcıyı Veritabanına Kaydetme ---
        const insertUserQuery = 'INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3) RETURNING id, username, email';
        const insertUserResult = await client.query(insertUserQuery, [username, email, passwordHash]);

        const newUser = insertUserResult.rows[0]; // Yeni eklenen kullanıcının bilgilerini al

        // --- 5. Başarılı Cevap Gönderme ---
        res.writeHead(201, { 'Content-Type': 'application/json' }); // 201 Created
        res.end(JSON.stringify({
            message: 'Kullanıcı başarıyla kaydedildi.',
            user: { id: newUser.id, username: newUser.username, email: newUser.email }
        }));

    } catch (error) { // Yakalanan hatayı genel bir 'error' olarak adlandırıyoruz
        console.error('Kayıt işlemi sırasında beklenmedik hata:', error.message);
        // Genellikle JSON ayrıştırma hataları veya diğer beklenmedik hatalar buraya düşer.
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Geçersiz JSON formatı veya sunucu hatası.' }));
    } finally {
        // Veritabanı bağlantısını her durumda (hata olsa da olmasa da) havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// --- Kullanıcı Giriş İşlemi (POST /login) ---
// Bu fonksiyon, kullanıcı giriş isteğini işler ve başarılı olursa bir JWT döndürür.
const loginUser = async (req, res, body) => {
    let client;
    try {
        const { email, password } = JSON.parse(body); // Giriş için e-posta ve şifreyi al

        // Giriş bilgilerinin boş olup olmadığını kontrol et
        if (!email || !password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'E-posta ve şifre gerekli.' }));
            return;
        }

        client = await pool.connect(); // Veritabanı bağlantısı al

        // E-posta ile kullanıcıyı veritabanında ara
        const userQuery = 'SELECT id, username, email, password_hash FROM users WHERE email = $1';
        const userResult = await client.query(userQuery, [email]);

        // Kullanıcı bulunamazsa
        if (userResult.rows.length === 0) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }

        const user = userResult.rows[0]; // Bulunan kullanıcı bilgileri

        // --- Şifre Karşılaştırma ---
        // Kullanıcının girdiği şifre ile veritabanındaki hashlenmiş şifreyi karşılaştır
        const isMatch = await bcrypt.compare(password, user.password_hash);

        // Şifreler eşleşmezse
        if (!isMatch) {
            res.writeHead(401, { 'Content-Type': 'application/json' }); // 401 Unauthorized
            res.end(JSON.stringify({ error: 'Geçersiz e-posta veya şifre.' }));
            return;
        }

        // --- JWT (JSON Web Token) Oluşturma ---
        // Şifreler eşleşiyorsa, kullanıcı için bir JWT oluştur.
        // Bu token, kullanıcının benzersiz ID'sini (payload) içerir.
        // JWT_SECRET ile imzalanır ve 1 saat (1h) geçerli olur.
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email }, // Token'ın içereceği bilgiler (payload)
            JWT_SECRET, // Sunucunun token'ı imzalamak için kullandığı gizli anahtar
            { expiresIn: '1h' } // Token'ın geçerlilik süresi (1 saat)
        );

        // Başarılı giriş cevabı döndür
        res.writeHead(200, { 'Content-Type': 'application/json' }); // 200 OK
        res.end(JSON.stringify({
            message: 'Giriş başarılı.',
            token: token, // Oluşturulan JWT'yi kullanıcıya gönderiyoruz
            user: { id: user.id, username: user.username, email: user.email } // Kullanıcı bilgilerini de gönder
        }));

    } catch (error) {
        console.error('Giriş işlemi sırasında hata:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' }); // 500 Internal Server Error
        res.end(JSON.stringify({ error: 'Sunucu hatası: Giriş yapılamadı.' }));
    } finally {
        if (client) {
            client.release(); // Veritabanı bağlantısını serbest bırak
        }
    }
};

// Bu fonksiyonları diğer modüllerin (örn. index.js) kullanabilmesi için dışa aktarıyoruz.
module.exports = {
    registerUser, // registerUser fonksiyonunu dışa aktarıyoruz
    loginUser     // loginUser fonksiyonunu dışa aktarıyoruz
};