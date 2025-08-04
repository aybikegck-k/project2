// src/middlewares/authMiddleware.js
// Bu dosya, HTTP isteklerinin kimlik doğrulamasını (JWT kontrolü) yapar.

const jwt = require('jsonwebtoken'); // JWT işlemleri için gerekli kütüphane
require('dotenv').config();  // .env dosyasındaki ortam değişkenlerini yükler (JWT_SECRET için)

console.log('Middleware JWT_SECRET:', process.env.JWT_SECRET);

// JWT gizli anahtarını .env dosyasından alıyoruz.
// Bu anahtar, token'ları imzalamak ve doğrulamak için kullanılır. ÇOK GİZLİ TUTULMALIDIR.
const JWT_SECRET = process.env.JWT_SECRET;

// Eğer JWT_SECRET tanımlı değilse, uygulamanın çalışması imkansızdır.
// Bu durumda hata mesajı gösterip uygulamayı durdururuz.
if (!JWT_SECRET) {
    console.error("HATA: JWT_SECRET .env dosyasında tanımlanmamış! Lütfen .env dosyasını kontrol edin.");
    process.exit(1); // Uygulamayı sonlandır (JWT_SECRET olmadan güvenlik sağlanamaz)
}

// authenticateToken adında bir middleware fonksiyonu tanımlıyoruz.
// Middleware'ler, ana route (yol) handler'ına ulaşmadan önce istekleri işleyen ara katmanlardır.
// req: Gelen HTTP isteği objesi (request)
// res: Gönderilecek HTTP yanıtı objesi (response)
// callback: Middleware başarılı olursa çağrılacak bir sonraki fonksiyon.
//           Bu genellikle isteği işleyecek asıl fonksiyon (örn. /shorten içindeki kod) olur.
const authenticateToken = async (req, res, callback) => {
    // İsteğin başlıklarındaki (headers) 'authorization' alanını alıyoruz.
    // Kullanıcılar JWT token'larını bu başlık içinde gönderirler.
    // Formatı genellikle "Bearer TOKEN_DEĞERİ" şeklindedir.
    const authHeader = req.headers['authorization'];
    // src/middlewares/authMiddleware.js
const authenticateToken = async (req, res, callback) => {
    const authHeader = req.headers['authorization'];
    
    // <<< Bu satırları ekleyin <<<
    console.log('Gelen Authorization Başlığı:', authHeader);
    const token = authHeader && authHeader.split(' ')[1];
    console.log('Middleware Tarafından Ayrıştırılan Token:', token);
    // >>> Buraya kadar <<<

    if (!token) {
        req.user = null;
        await callback();
        return;
    }

    // ... (geri kalan kod)
};
    // authHeader varsa ve "Bearer " ile başlıyorsa, token değerini ayırarak alıyoruz.
    const token = authHeader && authHeader.split(' ')[1];

    // --- ANONİM ERİŞİM KONTROLÜ (TOKEN YOKSA) ---
    // Eğer istekte JWT token'ı yoksa (yani kullanıcı giriş yapmamış veya token göndermemişse):
    if (!token) { //öncesinde token yoken direkt hata döndürüyordu şimdi token olmasa da çalısıyor(anonim girş hakkı için)
        req.user = null; // req.user objesini null olarak belirliyoruz.
                         // Bu, bir sonraki işleyiciye (callback) bu isteğin anonim olduğunu bildirir.
        await callback(); // İsteğin işlenmeye devam etmesine izin veriyoruz.
                          // Bu sayede, token olmasa bile /shorten endpoint'indeki ana mantık çalışabilir.
        return; // Fonksiyonu burada sonlandırıyoruz, daha fazla kod çalıştırmaya gerek yok.
    }

    // --- YETKİLİ ERİŞİM KONTROLÜ (TOKEN VARSA) ---
    // Eğer istekte bir JWT token'ı varsa, bu token'ın geçerliliğini doğrulamaya çalışırız.
    try {
        // jwt.verify fonksiyonu bir callback tabanlı API olduğu için,
        // bunu bir Promise içine alarak async/await ile daha kolay kullanabilir hale getiriyoruz.
        const user = await new Promise((resolve, reject) => {
            // Token'ı gizli anahtar (JWT_SECRET) ile doğrula.
            // Eğer başarılı olursa, token'ın içindeki payload (kullanıcı bilgileri) 'decoded' olarak döner.
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    // Eğer token doğrulanamazsa (örn: geçersiz imza, süresi dolmuş, bozuk token):
                    return reject(err); // Promise'ı reddet ve hatayı yakala
                }
                // Token başarılı bir şekilde çözümlenirse, içindeki payload'ı (kullanıcı bilgileri) döndür.
                resolve(decoded);
            });
        });

        // Doğrulanmış kullanıcı bilgilerini req.user objesine atıyoruz.
        // Böylece bir sonraki fonksiyon (callback) bu kullanıcının ID'sine, username'ine vb. erişebilir.
        req.user = user; 
        await callback(); // İsteğin işlenmeye devam etmesine izin veriyoruz (ana route handler'ına geç).

    } catch (err) {
        // Token doğrulama sırasında herhangi bir hata oluşursa (örn. JWT_SECRET yanlış, token bozuk, süresi dolmuş):
        console.error('JWT doğrulama hatası:', err.message); // Hatanın detayını sunucu konsoluna yazdır
        res.writeHead(403, { 'Content-Type': 'application/json' }); // 403 Forbidden HTTP durum kodu gönderiyoruz.
                                                                    // Bu, isteğin yetkisiz olduğu anlamına gelir.
        res.end(JSON.stringify({ message: 'Erişim reddedildi: Geçersiz veya süresi dolmuş token.' }));
        // Middleware burada bir yanıt gönderdiği için, isteğin daha fazla ilerlemesini durdur.
        return; 
    }
};

// Bu middleware fonksiyonunu dışarıya açıyoruz ki index.js gibi diğer dosyalar kullanabilsin.
module.exports = {
    authenticateToken
};