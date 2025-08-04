// src/index.js
// Bu dosya, Node.js HTTP sunucusunu kurar ve gelen tüm istekleri (route'ları) ilgili kontrolcülere yönlendirir.
// Uygulamanın ana giriş noktasıdır.
require('dotenv').config(); // .env dosyasındaki değişkenleri process.env üzerinden kullanabilmek için yüklüyoruz

const http = require('http'); // HTTP sunucusu kurmak için gerekli modül (Node.js'in çekirdek modülü)
const url = require('url');   // URL'leri parçalamak (parse etmek) için gerekli modül (Node.js'in çekirdek modülü)
const fs = require('fs').promises; // frontend için dosya sistemi işlemleri (PROMISE TABANLI OLARAK DEĞİŞTİRDİK)
const path = require('path'); // frontend için yol işlemleri


const pool = require('./config/db'); // Veritabanı bağlantı havuzumuz (PostgreSQL) - Veritabanı işlemleri için kullanılır

// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU BAŞLANGICI (require satırı kaldırıldı/yorumlandı) >>>>>>>>>
// generateShortCode ve isValidUrl yardımcı fonksiyonlarını artık doğrudan index.js'te kullanmıyoruz.
// Bu fonksiyonlar artık sadece urlController.js içerisinde kullanıldığı için buradan kaldırabiliriz
// veya bu şekilde yorum satırı yapabiliriz. Kodun çalışmasını etkilemez.
// const { generateShortCode, isValidUrl } = require('./utils/helpers'); 
// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU SONU >>>>>>>>>

const authController = require('./controllers/authController'); // Kullanıcı kayıt ve giriş (authentication) işlemleri için kontrolcü
const authMiddleware = require('./middlewares/authMiddleware'); // JWT doğrulama middleware'i - İstekleri doğrulamak için kullanılır

// <<<<<<<<< YENİ EKLENEN KOD BLOĞU BAŞLANTILARI >>>>>>>>>
// urlController modülünü içeri aktarıyoruz. Bu, URL kısaltma ve yönlendirme mantığını içerir.
const urlController = require('./controllers/urlController'); 
// <<<<<<<<< YENİ EKLENEN KOD BLOĞU SONU >>>>>>>>>

const PORT = process.env.PORT || 3000; // .env dosyasında PORT tanımlıysa onu kullan, yoksa varsayılan olarak 3000'i kullan

// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU BAŞLANGICI (taşınan değişkenlerin açıklaması) >>>>>>>>>
// Daha önce burada tanımlı olan 'anonymousRequestCounts' ve 'ANONYMOUS_LIMIT' değişkenleri
// artık 'src/controllers/urlController.js' dosyasına taşınmıştır.
// Bu sayede index.js daha temiz ve sadece routing (yönlendirme) işini yapar.
// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU SONU >>>>>>>>>


// --- HTTP Sunucusunu Oluştur ---
// http.createServer metodu, her gelen HTTP isteği için belirtilen async fonksiyonu çalıştırır.
    const server = http.createServer(async (req, res) => { 
    const parsedUrl = url.parse(req.url, true); // Gelen isteğin URL'sini parçalara ayırır (örn: pathname, query parametreleri)
    let pathname = parsedUrl.pathname; // pathname'i 'let' yapıyoruz çünkü aşağıda değiştirebiliriz
    const method = req.method;

    // --- ÖNEMLİ: STATİK DOSYA SUNUMU BAŞLANGICI ---
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

    // --- STATİK DOSYA SUNUMU SONU ---


    // --- CORS (Çapraz Kaynak Paylaşımı) Başlıkları ---
    // Bu başlıklar, farklı bir kaynaktan (örn. bir frontend uygulaması veya başka bir alan adı) 
    // gelen isteklerin sunucu tarafından kabul edilmesini sağlar. Güvenlik için önemlidir.
    res.setHeader('Access-Control-Allow-Origin', '*'); // Tüm kaynaklardan gelen isteklere izin ver (*) - Üretimde belirli alan adlarıyla sınırlandırılmalı!
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // İzin verilen HTTP metodları
    // İzin verilen HTTP başlıkları. 'Content-Type' gönderilen verinin tipini, 'Authorization' JWT token'ı göndermek için gereklidir!
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // --- OPTIONS İsteklerini Ele Al (Preflight İstekleri) ---
    // Tarayıcılar, karmaşık POST veya kimlik doğrulamalı (Authorization başlığı içeren) istekler göndermeden önce 
    // sunucuya bir "OPTIONS" (preflight) isteği yollar. Bu, güvenlik amacıyla sunucunun izinlerini kontrol etmesini sağlar.
    if (method === 'OPTIONS') {
        res.writeHead(204); // 204 No Content: İstek başarıyla işlendi ama döndürülecek içerik yok
        res.end();// Yanıtı sonlandır
        return;// Fonksiyonu burada sonlandır, daha fazla kod çalıştırma
    }

    // --- KULLANICI KAYIT İŞLEMİ (POST /register) ---
    // Yeni bir kullanıcı kaydı için POST isteğini dinler.
        if (pathname === '/api/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { // İsteğin body'sindeki verileri parça parça oku (veri akışı olduğu için 'chunk'lar halinde gelir)
            body += chunk.toString(); // Okunan parçaları birleştir (string olarak)
        });
        req.on('end', async () => { // Tüm body verisi okunduğunda (veri alımı tamamlandığında)
            // authController'daki registerUser fonksiyonunu çağır. Bu fonksiyon kendi içinde yanıt dönecektir.
            await authController.registerUser(req, res, body);
        });
        return; // İşlem bittiği için fonksiyonu sonlandır (req.on('end') asenkron olduğu için bu önemlidir)
    }

    // --- KULLANICI GİRİŞ İŞLEMİ (POST /login) ---
    // Kullanıcı girişi ve JWT token'ı almak için POST isteğini dinler.
    if (pathname === '/api/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { // İsteğin body'sindeki verileri parça parça oku
            body += chunk.toString(); // Okunan parçaları birleştir (string olarak)
        });
        req.on('end', async () => { // Tüm body verisi okunduğunda
            // authController'daki loginUser fonksiyonunu çağır. Bu fonksiyon kendi içinde yanıt dönecektir.
            await authController.loginUser(req, res, body);
        });
        return; // İşlem bittiği için fonksiyonu sonlandır
    }

    // --- URL KISALTMA İŞLEMİ (POST /shorten) ---
    // Bu endpoint, hem kayıtlı hem de anonim kullanıcılar tarafından kullanılabilir.
    // Tüm URL kısaltma mantığı artık urlController.js dosyasına taşındı.

    if (pathname === '/api/shorten' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { // İsteğin body'sindeki verileri parça parça oku
            body += chunk.toString(); // Okunan parçaları birleştir (string olarak)
        });

        req.on('end', async () => { // Tüm body verisi okunduğunda
            // authMiddleware.authenticateToken'ı çağırıyoruz. Bu middleware,
            // isteğin Authorization başlığında bir JWT token varsa onu doğrular ve req.user objesini doldurur.
            // Ardından, içindeki callback fonksiyonunu çalıştırır (yani urlController.shortenUrl).
            await authMiddleware.authenticateToken(req, res, async () => {
                // urlController'daki shortenUrl fonksiyonunu çağırıyoruz.
                // req, res, body ve PORT (kısaltılmış URL'yi oluşturmak için gerekli) parametrelerini iletiyoruz.
                // Bu fonksiyon, URL kısaltma işlemini ve ilgili tüm kontrolleri (anonim limit, IP takibi vb.) yönetecek.
                await urlController.shortenUrl(req, res, body, PORT);
            });
        });
        return; // req.on('end') olayını bekliyoruz, bu nedenle burada fonksiyonu sonlandırıyoruz.
    }


    // <<<<<<<<< BU KOD BLOĞUNU src/index.js DOSYANIZA EKLEYİN >>>>>>>>>

    // --- KULLANICININ URL'LERİNİ LİSTELEME İŞLEMİ (GET /urls) ---
    // Bu endpoint, sadece kimliği doğrulanmış (giriş yapmış) kullanıcıların erişebileceği kendi kısaltılmış URL'lerini listeler.
    if (pathname === '/api/urls' && method === 'GET') {
        // authMiddleware.authenticateToken'ı çağırıyoruz.
        // Bu middleware, Authorization başlığında bir JWT token olup olmadığını kontrol eder,
        // doğrular ve geçerliyse req.user objesini kullanıcı bilgileriyle doldurur.
        // Ardından, içindeki callback fonksiyonunu çalıştırır (yani urlController.listUserUrls).
        await authMiddleware.authenticateToken(req, res, async () => {
            // urlController'daki listUserUrls fonksiyonunu çağırıyoruz.
            // req, res ve PORT (kısaltılmış URL'leri oluşturmak için) parametrelerini iletiyoruz.
            await urlController.listUserUrls(req, res, PORT);
        });
        return; // İşlem bittiği için fonksiyonu sonlandır.
    }


    // <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU BAŞLANGICI (URL YÖNLENDİRME ARTIK urlController'da) >>>>>>>>>
    // --- URL YÖNLENDİRME İŞLEMİ (GET İSTEKLERİ) ---
    // Eğer gelen istek bir GET metoduysa VE path kök dizin '/' değilse (örn: "/abcde"),
    // bunun kısaltılmış bir URL olduğunu varsayarız ve yönlendirme işlemini başlatırız.
    // Bu mantık artık urlController.redirectUrl fonksiyonuna taşındı.
    if (method === 'GET' && pathname.length > 1) { // pathname.length > 1 kontrolü ile '/' dışındaki her şeyi yakala
        const shortCode = pathname.substring(1); // URL'den kısa kodu al (örn: '/abcde' -> 'abcde', ilk '/' kaldırılır)
        // urlController'daki redirectUrl fonksiyonunu çağırıyoruz.
        // Bu fonksiyon, kısa kodu veritabanında arayıp orijinal URL'ye yönlendirme işlemini yapacak.
        await urlController.redirectUrl(req, res, shortCode);
        return; // İşlem bittiği için fonksiyonu sonlandır.
    }
    // <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU SONU >>>>>>>>>


    // --- 404 (BULUNAMADI) HATASI ---
    // Eğer yukarıdaki hiçbir statik dosya veya API rota eşleşmezse, 404 Not Found gönder.
    // Bu kısım artık ana sayfa isteği için "URL Kisaltma Servisi Calisiyor!" mesajını içermemeli,
    // çünkü ana sayfa isteği yukarıdaki statik dosya sunumu tarafından yakalanmalı.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: Aradiginiz sayfa veya kaynak bulunamadi.');
});

// Sunucuyu Belirtilen Portta Dinlemeye Başla
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});