// src/index.js
// Bu dosya, Node.js HTTP sunucusunu kurar ve gelen tüm istekleri (route'ları) ilgili kontrolcülere yönlendirir.
// Uygulamanın ana giriş noktasıdır.
require('dotenv').config(); // .env dosyasındaki değişkenleri process.env üzerinden kullanabilmek için yüklüyoruz

const http = require('http'); // HTTP sunucusu kurmak için gerekli modül (Node.js'in çekirdek modülü)
const url = require('url');   // URL'leri parçalamak (parse etmek) için gerekli modül (Node.js'in çekirdek modülü)

const pool = require('./config/db'); // Veritabanı bağlantı havuzumuz (PostgreSQL) - Veritabanı işlemleri için kullanılır

// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU BAŞLANGICI (require satırı kaldırıldı/yorumlandı) >>>>>>>>>
// generateShortCode ve isValidUrl yardımcı fonksiyonlarını artık doğrudan index.js'te kullanmıyoruz.
// Bu fonksiyonlar artık sadece urlController.js içerisinde kullanıldığı için buradan kaldırabiliriz
// veya bu şekilde yorum satırı yapabiliriz. Kodun çalışmasını etkilemez.
// const { generateShortCode, isValidUrl } = require('./utils/helpers'); 
// <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU SONU >>>>>>>>>

const authController = require('./controllers/authController'); // Kullanıcı kayıt ve giriş (authentication) işlemleri için kontrolcü
const authMiddleware = require('./middlewares/authMiddleware'); // JWT doğrulama middleware'i - İstekleri doğrulamak için kullanılır

// <<<<<<<<< YENİ EKLENEN KOD BLOĞU BAŞLANGICI >>>>>>>>>
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
    const path = parsedUrl.pathname;             // URL'nin yol kısmını alır (örn: "/shorten", "/abcde")
    const method = req.method;                   // Gelen isteğin HTTP metodunu alır (örn: "GET", "POST", "OPTIONS")

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
        res.end();          // Yanıtı sonlandır
        return;             // Fonksiyonu burada sonlandır, daha fazla kod çalıştırma
    }

    // --- KULLANICI KAYIT İŞLEMİ (POST /register) ---
    // Yeni bir kullanıcı kaydı için POST isteğini dinler.
    if (path === '/register' && method === 'POST') {
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
    if (path === '/login' && method === 'POST') {
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

    if (path === '/shorten' && method === 'POST') {
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
    if (path === '/urls' && method === 'GET') {
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
    if (method === 'GET' && path !== '/') {
        const shortCode = path.substring(1); // URL'den kısa kodu al (örn: '/abcde' -> 'abcde', ilk '/' kaldırılır)
        // urlController'daki redirectUrl fonksiyonunu çağırıyoruz.
        // Bu fonksiyon, kısa kodu veritabanında arayıp orijinal URL'ye yönlendirme işlemini yapacak.
        await urlController.redirectUrl(req, res, shortCode);
        return; // İşlem bittiği için fonksiyonu sonlandır.
    }
    // <<<<<<<<< DEĞİŞTİRİLEN KOD BLOĞU SONU >>>>>>>>>


    // --- 3. ANA SAYFA VE DİĞER İSTEKLER ---
    // Eğer yukarıdaki koşulların hiçbiri eşleşmezse (yani ana sayfaya "/" istek gelirse)
    if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); // 200 OK: Başarı kodu, yanıt metin (plain text) formatında olacak
        res.end('URL Kisaltma Servisi Calisiyor! Uzun bir URL kisaltmak icin /shorten adresine POST istegi gonderin.');
    } else {
        // Genel 404 (bulunamadı) hatası - Yukarıdaki rotalarla eşleşmeyen tüm istekler için
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Sayfa Bulunamadi.');
    }
});

// Sunucuyu Belirtilen Portta Dinlemeye Başla
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});