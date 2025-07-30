// src/utils/helpers.js
//src/utils/: Yardımcı fonksiyonları (helpers.js gibi) içeriyor.

// Rastgele kısa bir kod oluşturan fonksiyon
function generateShortCode() {
    // 6 karakter uzunluğunda rastgele bir string oluşturur
    // (a-z, A-Z, 0-9 karakterlerini kullanırız)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = ''; //her seferinde rastgele seçilen karakterler buna eklenecek
    for (let i = 0; i < 6; i++) {
        // Karakterler listesinden rastgele bir karakter seç
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    } //sonuc olarak bir karakter seçilir ve result değişkenine eklenir
    return result;
}

// Bir URL'nin geçerli olup olmadığını basitçe kontrol eden fonksiyon
function isValidUrl(string) { // <<< BURAYI DEĞİŞTİRDİM
    try {
        // 'new URL(string)' ile URL oluşturmaya çalışırız.
        // Eğer geçerli bir URL değilse hata fırlatır.
        new URL(string);
        return true;
    } catch (e) {
        // Hata fırlatırsa geçersiz URL'dir.
        return false;
    }
}

// Bu fonksiyonları başka dosyalarda kullanabilmek için dışa aktarıyoruz
module.exports = {
    generateShortCode, //özetle bu fonk 6 karakterlik rastgele kısa kod üretir
    isValidUrl, // <<< BURAYI DEĞİŞTİRDİM - bu fonk ise verilen string geçerli bir url mi diye kontrol eder
    // ve her çağırıldgında farklı kod üretir
};