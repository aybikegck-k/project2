// src/routes/urlRoutes.js
// Bu dosya, URL kısaltma, listeleme ve yönlendirme ile ilgili tüm API rotalarını yönetir.

const url = require('url');
const urlController = require('../controllers/urlController');
const authMiddleware = require('../middlewares/authMiddleware');

// Gelen isteği URL ile ilgili rotalarla eşleştiren ana fonksiyon.
const handleUrlRoutes = async (req, res, PORT) => {
    const { pathname } = url.parse(req.url, true);
    const method = req.method;

    // POST /api/shorten: URL kısaltma işlemi için rota
    if (method === 'POST' && pathname === '/api/shorten') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            // İsteğe bağlı olarak JWT token doğrulamasını yap
            await authMiddleware.authenticateToken(req, res, async () => {
                await urlController.shortenUrl(req, res, body, PORT);
            });
        });
        return true; // Rota eşleşti ve işlendi
    }

    // GET /api/urls: Giriş yapmış kullanıcının linklerini listeleme rotası
    if (method === 'GET' && pathname === '/api/urls') {
        // Bu rotaya sadece geçerli bir JWT token'ı olan kullanıcılar erişebilir.
        await authMiddleware.authenticateToken(req, res, async () => {
            await urlController.listUserUrls(req, res, PORT);
        });
        return true; // Rota eşleşti ve işlendi
    }
    
    // GET /:shortCode: Kısaltılmış linkin orijinal adrese yönlendirme rotası
    // Regex ile 5 karakterli alfanümerik kodları yakalar
    const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9]{6})$/);
    if (method === 'GET' && shortCodeMatch) {
        const shortCode = shortCodeMatch[1];
        await urlController.redirectUrl(req, res, shortCode);
        return true; // Rota eşleşti ve işlendi
    }
    
    return false; // Hiçbir URL rotası eşleşmedi
};

module.exports = { handleUrlRoutes };