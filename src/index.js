// src/index.js
// Bu dosya, Node.js HTTP sunucusunu kurar, veritabanı bağlantısını test eder ve gelen istekleri
// ilgili rota yöneticilerine (router) yönlendirir. Uygulamanın ana giriş noktasıdır.

require('dotenv').config(); // .env dosyasındaki ortam değişkenlerini yükler

const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');
const pool = require('./config/db'); // Veritabanı bağlantı havuzu

// Rota yöneticilerini (routers) içeri aktarma.
// Bu modüller, gelen istekleri belirli API rotalarına göre gruplar.
const urlRouter = require('./routes/urlRoutes');
const authRouter = require('./routes/authRoutes');

const PORT = process.env.PORT || 3000; // Sunucunun çalışacağı port numarası

// Veritabanına bağlantıyı uygulama başlamadan önce test etme
(async () => {
    try {
        await pool.connect();
        console.log('PostgreSQL veritabanına başarıyla bağlandı.');
    } catch (err) {
        console.error('Veritabanına bağlanılamadı:', err.stack);
        // Hata durumunda uygulamayı sonlandır, çünkü veritabanı olmadan çalışamaz
        process.exit(1); 
    }
})();

// HTTP Sunucusunu oluşturma
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    const method = req.method;
 // Bu kısım, API rotalarından ÖNCE ve senkron bir şekilde kontrol edilmelidir.

    const PUBLIC_DIR = path.join(__dirname, '..', 'frontend'); // 'src' klasöründen 'public' klasörüne giden yol

    // Eğer tarayıcı sadece '/' (kök dizini) isterse, 'index.html'i varsay.
    const requestedPath = (pathname === '/') ? '/index.html' : pathname;
    const filePath = path.join(PUBLIC_DIR, requestedPath); // Dosyanın tam yolunu oluştur

    try {
        const stats = await fs.stat(filePath); // Dosyanın varlığını ve tipini kontrol et
        if (stats.isFile()) { // Eğer gerçekten bir dosya ise
            const data = await fs.readFile(filePath); // fs.promises.readFile kullanıyoruz

            // Dosya türüne göre Content-Type başlığını ayarla
            let contentType = 'text/html';
            if (filePath.endsWith('.css')) {
                contentType = 'text/css';
            } else if (filePath.endsWith('.js')) {
                contentType = 'application/javascript';
            } else if (filePath.endsWith('.png')) {
                contentType = 'image/png';
            } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
                contentType = 'image/jpeg';
            } else if (filePath.endsWith('.gif')) {
                contentType = 'image/gif';
            } else if (filePath.endsWith('.svg')) {
                contentType = 'image/svg+xml';
            } else if (filePath.endsWith('.ico')) {
                contentType = 'image/x-icon';
            } else if (filePath.endsWith('.json')) { // Eğer ileride bir JSON dosyası sunarsanız
                contentType = 'application/json';
            }
            // Diğer dosya türlerini buraya ekleyebilirsiniz

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
            return; // Statik dosya başarıyla gönderildi, DİĞER HİÇBİR KOD BLOĞUNA GİTME
        }
    } catch (err) {
        // Dosya bulunamadıysa (ENOENT hatası) veya başka bir hata varsa,
        // bu statik dosya isteği değildir, akışı API rotalarına bırak.
        if (err.code !== 'ENOENT') { // ENOENT dışındaki hataları konsola yazdır
            console.error(`Statik dosya işleme hatası (${filePath}):`, err);
            // Ciddi bir hata ise 500 dönebiliriz, ancak şimdilik akışı API'ye bırakalım
        }
    }

    // Güvenlik ve tarayıcılar arası iletişim için gerekli başlıkları ayarlar.
    res.setHeader('Access-Control-Allow-Origin', '*'); // Tüm kaynaklardan gelen isteklere izin ver (geliştirme için)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // İzin verilen HTTP metotları
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // İzin verilen başlıklar

    // Tarayıcılar karmaşık isteklerden önce bu isteği gönderir.
    if (method === 'OPTIONS') {
        res.writeHead(204); // 204 No Content
        res.end();
        return;
    }

    // --- Rota Yönlendirme Mantığı ---
    // Gelen isteği sırasıyla rota yöneticilerine gönderir.
    // Eğer bir rota yöneticisi isteği işlerse, `true` döndürür ve işlem durur.
    
    // 1. Kimlik doğrulama rotalarını kontrol et (/api/register, /api/login)
    if (await authRouter.handleAuthRoutes(req, res)) {
        return; 
    }
    
    // 2. URL yönetimi rotalarını kontrol et (/api/shorten, /api/urls, /:shortCode)
    if (await urlRouter.handleUrlRoutes(req, res, PORT)) {
        return;
    }


    // --- 404 (Bulunamadı) Hatası ---
    // Eğer hiçbir API rotası veya statik dosya bulunamazsa, 404 hatası döndürür.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: Aradiginiz sayfa veya kaynak bulunamadi.');
});

// Sunucuyu belirtilen portta başlatma
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});