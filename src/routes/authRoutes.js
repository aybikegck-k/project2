// src/routes/authRoutes.js
// Bu dosya, kullanıcı kayıt ve giriş işlemleri (authentication) ile ilgili API rotalarını yönetir.

const url = require('url');
const authController = require('../controllers/authController');

// Gelen isteği kimlik doğrulama rotalarıyla eşleştiren ana fonksiyon.
const handleAuthRoutes = async (req, res) => {
    const { pathname } = url.parse(req.url, true);
    const method = req.method;

    // POST /api/register: Yeni kullanıcı kayıt rotası
    if (method === 'POST' && pathname === '/api/register') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            await authController.registerUser(req, res, body);
        });
        return true; // Rota eşleşti ve işlendi
    }

    // POST /api/login: Kullanıcı giriş rotası ve JWT token oluşturma
    if (method === 'POST' && pathname === '/api/login') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            await authController.loginUser(req, res, body);
        });
        return true; // Rota eşleşti ve işlendi
    }
    
    return false; // Hiçbir kimlik doğrulama rotası eşleşmedi
};

module.exports = { handleAuthRoutes };