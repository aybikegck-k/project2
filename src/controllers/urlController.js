// src/controllers/urlController.js
// Bu dosya, URL kısaltma ve yönlendirme ile ilgili tüm iş mantığını içerir.
// Index.js dosyasının daha düzenli ve sadece yönlendirme odaklı kalmasını sağlar.

const pool = require('../config/db'); // Veritabanı bağlantı havuzumuzu içeri aktarıyoruz
const { generateShortCode, isValidUrl } = require('../utils/helpers'); // Yardımcı fonksiyonlarımızı içeri aktarıyoruz

// Bellek içi IP adresi sayaçları
// Bu obje, her bir IP adresinden yapılan anonim (giriş yapılmamış) kısaltma isteklerinin sayısını tutar.
// Örnek: {'192.168.1.1': 2, '172.0.0.1': 1}
// DİKKAT: Bu sayaçlar sunucu her yeniden başlatıldığında sıfırlanır (bellek içi oldukları için).
// Üretim ortamında, bu tür limitlerin Redis gibi kalıcı bir cache sisteminde veya veritabanında tutulması önerilir.

// URL kısaltma işlemini yapacak ana fonksiyon
// Bu fonksiyon, index.js'teki /shorten endpoint'i tarafından çağrılacak.
// req: Gelen HTTP isteği objesi
// res: HTTP yanıt objesi
// body: POST isteğinin body içeriği (originalUrl'yi içerir)
// PORT: Kısaltılmış URL'yi oluşturmak için gerekli olan sunucu portu (örn: http://localhost:PORT/...)
const shortenUrl = async (req, res, body, PORT) => {
    // authMiddleware veya başka bir middleware zaten bir yanıt göndermişse,
    // (örn. geçersiz token nedeniyle 403 hatası gibi), bu fonksiyonun daha fazla işlem yapmasını engelleriz.
    if (res.headersSent) {
        return;
    }

    // Gelen isteğin IP adresini alıyoruz.
    // 'x-forwarded-for' başlığı genellikle proxy veya load balancer arkasındayken gerçek istemci IP'sini sağlar.
    // Eğer bu başlık yoksa, req.socket.remoteAddress doğrudan bağlantının IP adresini verir (yerel testlerde genelde bu kullanılır).
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`Gelen istek IP: ${ipAddress}`);

 
    try {
        // İsteğin body'sinden 'originalUrl' değerini JSON olarak ayrıştırıyoruz.
        const { longUrl } = JSON.parse(body);

        // Gelen 'originalUrl' boşsa veya geçerli bir URL formatında değilse:
        if (!longUrl || !isValidUrl(longUrl)) {
            // 400 Bad Request (Hatalı İstek) yanıtı gönderilir.
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Geçersiz URL formatı.' }));
            return; // Fonksiyonu burada sonlandır.
        }

        let shortCode; // Oluşturulacak kısa kod
        let client;    // Veritabanı bağlantı nesnesi
        try {
            client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al

            // Benzersiz bir kısa kod oluşturmak için döngü. Maksimum 5 deneme yapılır.
            for (let i = 0; i < 5; i++) {
                const codeCandidate = generateShortCode(); // Yeni bir rastgele kısa kod adayı oluştur
                const checkQuery = 'SELECT id FROM urls WHERE short_code = $1'; // Aday kodun veritabanında olup olmadığını kontrol etme sorgusu
                const checkResult = await client.query(checkQuery, [codeCandidate]); // Sorguyu çalıştır

                // Eğer veritabanında bu kısa kod yoksa (daha önce kullanılmamışsa):
                if (checkResult.rows.length === 0) {
                    shortCode = codeCandidate; // Bu kodu kullanabiliriz
                    break; // Döngüden çık
                }
                // Eğer 5 deneme sonunda hala benzersiz bir kod bulunamazsa, hata fırlat.
                if (i === 4) {
                    throw new Error('Kısa kod oluşturulamadı, lütfen tekrar deneyin.');
                }
            }

            // Döngüden çıktıktan sonra hala bir shortCode belirlenmemişse, bu da bir hata durumudur.
            if (!shortCode) {
                throw new Error('Kısa kod oluşturulamadı, bilinmeyen bir hata oluştu.');
            }

            // Eğer kullanıcı giriş yapmışsa (req.user objesi varsa), userId'yi al, yoksa null ata (anonim kullanıcı).
            const userId = req.user ? req.user.id : null; 

            // Yeni URL kaydını veritabanına ekle sorgusu
            const insertQuery = 'INSERT INTO urls(original_url, short_code, user_id, ip_address) VALUES($1, $2, $3, $4) RETURNING short_code';
            const result = await client.query(insertQuery, [longUrl, shortCode, userId, ipAddress]);

            // Başarılı 201 Created (Oluşturuldu) yanıtı gönderilir.
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                originalUrl: longUrl, // Orijinal uzun URL
                shortUrl: `http://localhost:${PORT}/${result.rows[0].short_code}`, // Kısaltılmış URL
                // Mesajı, kullanıcının giriş durumuna göre özelleştir.
                message: userId ? "URL başarıyla kısaltıldı." : "URL başarıyla kısaltıldı (anonim).",
                
            }));

        } catch (dbErr) {
            // Veritabanı işlemi sırasında oluşabilecek hataları yakala
            console.error(' Veritabanı işlemi sırasında hata:', dbErr.message);
            // Eğer yanıt başlıkları zaten gönderilmediyse (önceki bir hata veya işlemden dolayı),
            // 500 Internal Server Error (Sunucu Hatası) yanıtı gönderilir.
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Sunucu hatası: URL kısaltılamadı.' }));
            }
        } finally {
            // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
            if (client) {
                client.release();
            }
        }
    } catch (handlerError) {
        // JSON ayrıştırma hatası veya genel işlem hatalarını yakala
        console.error(' İstek işleme sırasında hata:', handlerError.message);
        if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'İstek işlenirken bir sorun oluştu veya JSON formatı geçersiz.' }));
        }
    }
};

// URL yönlendirme işlemini yapacak fonksiyon
// Bu fonksiyon, index.js'teki GET /:shortCode endpoint'i tarafından çağrılacak.
// req: Gelen HTTP isteği objesi
// res: HTTP yanıt objesi
// shortCode: Yönlendirilecek kısa kod (örn: 'abcde')
const redirectUrl = async (req, res, shortCode) => {
    let client; // Veritabanı bağlantı nesnesi
    try {
        client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al
        const selectQuery = 'SELECT original_url FROM urls WHERE short_code = $1'; // Orijinal URL'yi bulma sorgusu
        const result = await client.query(selectQuery, [shortCode]); // Sorguyu çalıştır

        if (result.rows.length > 0) { // Eğer veritabanında bu kısa koda ait bir orijinal URL bulunursa:
            const longUrl = result.rows[0].original_url; // Orijinal URL'yi al
            // Bu kod bloğu, "tıklama sayısı"nı artırmak için gerekli.
            // Orijinal URL bulundu, şimdi tıklama sayısını artırıyoruz.
           // src/controllers/urlController.js
       await client.query(
         'UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1',
       [shortCode]
);
            console.log(` Kısa kod '${shortCode}' için tıklama sayısı artırıldı.`);

            res.writeHead(302, { 'Location': longUrl }); // 302 Found (Bulundu) yanıtı ile tarayıcıyı orijinal URL'ye yönlendir.
            res.end(); // Yanıtı sonlandır.
        } else {
            // Kısa kod veritabanında bulunamazsa:
            res.writeHead(404, { 'Content-Type': 'text/plain' }); // 404 Not Found (Bulunamadı) yanıtı gönder.
            res.end('Kisaltilmiş URL bulunamadi.'); // Kullanıcıya mesaj göster.
        }
    } catch (dbErr) {
        // Veritabanı sorgusu sırasında oluşabilecek hataları yakala
        console.error(' Veritabani sorgusu sirasinda hata:', dbErr.message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(500, { 'Content-Type': 'application/json' }); // 500 Internal Server Error (Sunucu Hatası)
            res.end(JSON.stringify({ error: 'Sunucu hatasi: Yönlendirme başarisiz.' }));
        }
    } finally {
        // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// Kullanıcının kısaltılmış URL'lerini listeleme fonksiyonu
const listUserUrls = async (req, res, PORT) => {
    if (!req.user || !req.user.id) {
        console.error("listUserUrls: req.user veya req.user.id bulunamadı.");
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Kimlik doğrulaması gereklidir veya kullanıcı bilgisi eksik." }));
        return;
    }

    const userId = req.user.id; // Giriş yapmış kullanıcının ID'si

    let client;
    try {
        client = await pool.connect();

        const query = `
            SELECT original_url, short_code, click_count, created_at
            FROM urls
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const result = await client.query(query, [userId]);

        const urls = result.rows.map(row => ({
            originalUrl: row.original_url,
            shortCode: row.short_code,
            shortUrl: `http://localhost:${PORT}/${row.short_code}`,
            clickCount: row.click_count,
            createdAt: row.created_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: "Kısaltılmış URL'ler başarıyla listelendi.",
            urls: urls
        }));

    } catch (dbErr) {
        console.error('Veritabanından kullanıcı URL\'lerini çekerken hata:', dbErr.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sunucu hatası: URL\'ler listelenemedi.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};


module.exports = {
    shortenUrl,
    redirectUrl,
    listUserUrls // fonksiyonlar dışa aktarılıyor
};
