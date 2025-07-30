// src/index.js
require('dotenv').config(); //.env dosyasındaki değişkenleri process.env üzerinden kullanabilmek için yüklüyoruz

const http = require('http'); //sunucu kurmak için
const url = require('url'); //url i parçalamak için

const pool = require('./config/db'); // Veritabanı bağlantısı
const { generateShortCode, isValidUrl } = require('./utils/helpers'); // <<< BURASI DEĞİŞTİRİLDİ (urlGecerliMi yerine isValidUrl)
//helpers.js :  kısa kod üretme ve url geçerliliği kontrolü
const authController = require('./controllers/authController'); 
const PORT = process.env.PORT || 3000; //.enc dosyasında port tanımlıysa onu ,yoksa 3000 kullan


// Sunucuyu Oluştur
const server = http.createServer(async (req, res) => { //sunucu isteklerini işleyen ana fonksiyon başlıyor req:gelen istek res:dönecek cevap
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
//yukarılarda gelen isteğin yyolunu ve metodunu alıyoruz
    // CORS (Çapraz Kaynak Paylaşımı) Başlıkları - Tarayıcıların farklı sitelerden istek atmasına izin verir
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//→ CORS başlıkları: Başka domain’lerden gelen isteklere izin ver (özellikle frontend çalışırken lazım).

// OPTIONS isteklerini ele al (Tarayıcılar, POST isteği göndermeden önce bunu yollar)
    if (method === 'OPTIONS') {
        res.writeHead(204); // Başarılı, içerik yok
        res.end();
        return;
    }

    // --- 1. URL KISALTMA İŞLEMİ (POST İSTEKLERİ) ---
    // Eğer istek "/shorten" yoluna POST metoduyla gelirse
    if (path === '/shorten' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            // Gelen veriyi (body) topluyoruz
            body += chunk.toString();
        });

        req.on('end', async () => {// veri toplandıktan sonra burası çalısır
            try {
                const { originalUrl } = JSON.parse(body); // JSON ı parçalayıp orijinal URL'yi al

                // URL geçerli mi kontrol et
                if (!originalUrl || !isValidUrl(originalUrl)) { // <<< BURASI DEĞİŞTİRİLDİ (urlGecerliMi yerine isValidUrl)
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Geçersiz URL formatı.' }));
                    return;
                }

                let shortCode; //kısa kodu tanımladık
                let client; //veritabanı bağlantısını tanımladık
                try {
                    client = await pool.connect(); // Veritabanına bağlıyrouz

                    // Benzersiz bir kısa kod bulana kadar dene
                    for (let i = 0; i < 5; i++) { // Max 5 deneme (çakışma olursa)
                        const codeCandidate = generateShortCode();
                        // Bu kısa kod zaten kullanılmış mı?
                        //5 kez sansımız var her denemede yeni kısa kod üretilir ve veritabanında çakısma var mı bakılır
                        const checkQuery = 'SELECT id FROM urls WHERE short_code = $1'; //veritabanında bu kısa kodun var olup olmadıgını kontrol eder bu sorgu
                        const checkResult = await client.query(checkQuery, [codeCandidate]);

                        if (checkResult.rows.length === 0) {
                            // Eğer kullanılmıyorsa, bu kodu kullan
                            shortCode = codeCandidate; //ürettiğimiz kodu shorCode değişkenine aktardık
                            break;
                        }
                        if (i === 4) { // 5 denemede de bulamazsak hata ver
                            throw new Error('Kısa kod oluşturulamadı, lütfen tekrar deneyin.');
                        }
                    }

                    // Kısa kodu bulamazsak hata döndür
                    if (!shortCode) {
                        throw new Error('Kısa kod oluşturulamadı, bilinmeyen bir hata oluştu.');
                    }

                    // kısa kodu ve orijinal url i Veritabanına kaydetme sorgusu
                    const insertQuery = 'INSERT INTO urls(original_url, short_code) VALUES($1, $2) RETURNING short_code';
                    //bu satır veritabanına yeni kayıt ekliyor $1 yerine originalUrl $2 yerine chortCode gelir
                    // returnıng shor_code ile eklenen kaydın kısa kodu tekrar alınır
                    const result = await client.query(insertQuery, [originalUrl, shortCode]);

                    // Başarılı cevabı döndür
                    res.writeHead(201, { 'Content-Type': 'application/json' }); // <<< BURADAKİ PARANTEZ HATASI DÜZELTİLDİ
                    // 201 http durum kodudur yani created (basarıyla olusturuldu anlamına gelir)
                    ///*dönen veri json formatında*/
                    res.end(JSON.stringify({ // <<< BURADAKİ JSON.stringify HATASI DÜZELTİLDİ
                        //stringify JavaScript nesnesini JSON formatına dönüştürür,
                        //  çünkü HTTP yanıtında JSON string olarak gönderilir.
                        //sunucu yanıtını sonlandırır içindeki veriyi istemciye gönderir
                        originalUrl: originalUrl,
                        shortUrl: `http://localhost:${PORT}/${result.rows[0].short_code}`
                    }));

                } catch (dbErr) {
                    console.error('Veritabanı işlemi sırasında hata:', dbErr.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Sunucu hatası: URL kısaltılamadı.' }));
                } finally {
                    if (client) {
                        client.release(); // Bağlantıyı her zaman geri bırak
                    }
                } //bağlantı her zaman geri bırakılır

            } catch (parseErr) {
                // JSON ayrıştırma hatası
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Geçersiz JSON formatı veya eksik veri.' }));
            }
        });
        return; // İşlem bitti, daha fazla kod çalıştırma
    }
// --- KULLANICI KAYIT İŞLEMİ (POST /register) ---
if (path === '/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        // authController.registerUser fonksiyonunu çağırıyoruz
        // req, res ve isteğin body'sini (JSON içeriğini) parametre olarak gönderiyoruz
        await authController.registerUser(req, res, body);
    });
    return; // İşlem bittiği için return ediyoruz
}
// --- KULLANICI GİRİŞ İŞLEMİ (POST /login) ---
if (path === '/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        // authController.loginUser fonksiyonunu çağırıyoruz
        // req, res ve isteğin body'sini (JSON içeriğini) parametre olarak gönderiyoruz
        await authController.loginUser(req, res, body);
    });
    return; // İşlem bittiği için return ediyoruz
}
    // --- 2. URL YÖNLENDİRME İŞLEMİ (GET İSTEKLERİ) ---
    // Eğer istek kök dizine (/) gelmezse, kısa kod olduğunu varsayarız
    if (path !== '/') {
        const shortCode = path.substring(1); // URL'den kısa kodu al (ör: '/abcde' -> 'abcde')

        let client; //postgresql için bir client nesnesi tanımmlanıyor
        try { //yukarıda tanımlanan client bu blok içinde kullanılacak
            client = await pool.connect(); // Veritabanı bağlantısı al
            //await *sayesinde bağlantı kurulmadan sonraki kısım çalışmaz

            // Kısa kodu veritabanında ara
            const selectQuery = 'SELECT original_url FROM urls WHERE short_code = $1';

            const result = await client.query(selectQuery, [shortCode]); //Yukarıdaki SQL sorgusu çalıştırılıyor.
            //$1 yerine shortCode değeri geçiyor.
            //Sonuç result.rows dizisine gelir.

            if (result.rows.length > 0) {
                // Eğer orijinal URL bulunursa, o adrese yönlendir
                const originalUrl = result.rows[0].original_url; //ilk satırdaki orijinal url alınır
                res.writeHead(302, { 'Location': originalUrl }); // 302 Found: tarayıcıya "bu kısa url ye karşılık gelen gerçek adres bu"denir
                res.end();
            } else {
                // Kısa kod bulunamazsa 404 Sayfa Bulunamadı hatası dön
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Kisaltilmiş URL bulunamadi.');
            }
        } catch (dbErr) {
            console.error('Veritabani sorgusu sirasinda hata:', dbErr.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sunucu hatasi: Yönlendirme başarisiz.' }));
        } finally { //finally bloğu her durumda çalışır (hata olsa da olmasa da).
            if (client) {
                client.release(); // Bağlantıyı her zaman geri bırak
            }
            // Veritabanı bağlantısı kapatılır (havuz sisteminde geri bırakılır).
        }
        return; // İşlem bitti
    }

    // --- 3. ANA SAYFA VE DİĞER İSTEKLER ---
    // Eğer yukarıdaki koşulların hiçbiri eşleşmezse (yani ana sayfaya istek gelirse)
    if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }); //200:tamam anlamında başarı kodu yanıt metin (text) formatında olacak
        res.end('URL Kisaltma Servisi Calisiyor! Uzun bir URL kisaltmak icin /shorten adresine POST istegi gonderin.');
    } else {
        // Genel 404 (bulunamadı) hatası - buraya normalde düşmemesi gerek, ama bir güvenlik önlemi
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Sayfa Bulunamadi.');
    }
});

// Sunucuyu Belirtilen Portta Dinlemeye Başla
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});