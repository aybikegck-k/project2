// script.js (Frontend JavaScript)
// Bu dosya, HTML sayfasındaki kullanıcı etkileşimlerini yönetir ve backend API'leriyle iletişim kurar.

// --- DOM (Document Object Model) Öğelerini Seçme ---
// HTML sayfasındaki belirli elementlere JavaScript ile erişmek için onların ID'lerini kullanıyoruz.
// Bu sayede bu elementlerin içeriğini değiştirebilir veya olay dinleyicileri ekleyebiliriz.
const longUrlInput = document.getElementById('longUrlInput');      // Uzun URL giriş kutusu
const shortenBtn = document.getElementById('shortenBtn');          // "Linkie'le!" butonu
const resultBox = document.getElementById('resultBox');            // Kısaltılmış linkin gösterileceği kutu
const shortenedLink = document.getElementById('shortenedLink');    // Kısaltılmış linkin kendisi (<a> etiketi)
const copyButton = document.getElementById('copyButton');          // Kısaltılmış linki kopyalama butonu
const messageBox = document.getElementById('messageBox');          // Genel mesajlar (başarı/hata) için kutu
const remainingUsesSpan = document.getElementById('remainingUsesSpan'); // Anonim kullanım hakkını gösteren span (şimdilik aktif değil)

// Kimlik doğrulama formları ve ilgili elementler
const showLoginBtn = document.getElementById('showLoginBtn');      // "Giriş Yap" formunu göster butonu
const showRegisterBtn = document.getElementById('showRegisterBtn'); // "Kayıt Ol" formunu göster butonu
const loginForm = document.getElementById('loginForm');            // Giriş formu div'i
const registerForm = document.getElementById('registerForm');      // Kayıt formu div'i
const registerBtn = document.getElementById('registerBtn');        // Kayıt Ol butonu
const loginBtn = document.getElementById('loginBtn');              // Giriş Yap butonu
const regUsername = document.getElementById('regUsername');        // Kayıt kullanıcı adı input'u
const regEmail = document.getElementById('regEmail');              // Kayıt e-posta input'u
const regPassword = document.getElementById('regPassword');        // Kayıt şifre input'u
const loginEmail = document.getElementById('loginEmail');          // Giriş e-posta input'u
const loginPassword = document.getElementById('loginPassword');    // Giriş şifre input'u
const registerMessage = document.getElementById('registerMessage'); // Kayıt formu mesaj kutusu
const loginMessage = document.getElementById('loginMessage');      // Giriş formu mesaj kutusu

// "Linklerimi Göster" butonu ve ilgili elementler
const listUrlsBtn = document.getElementById('listUrlsBtn');        // Linkleri listele butonu
const urlsListDiv = document.getElementById('urlsList');           // Linklerin listeleneceği div
const urlsMessageDiv = document.getElementById('urlsMessage');     // Link listesi için mesaj kutusu


// --- Yardımcı Fonksiyonlar ---

// Kullanıcıya mesaj göstermek için genel bir fonksiyon.
// Parametreler:
// - element: Mesajın gösterileceği HTML elementi (örn: messageBox, registerMessage)
// - message: Gösterilecek metin mesajı
// - type: Mesajın türü (örn: 'success' için yeşil, 'error' için kırmızı CSS sınıfı)
function showMessage(element, message, type) {
    element.textContent = message;         // Elementin metin içeriğini ayarla
    element.className = `message ${type}`; // CSS sınıfını (message success/error) ayarla
    element.style.display = 'block';       // Elementi görünür yap
    // 5 saniye sonra mesajı otomatik olarak gizle (daha iyi kullanıcı deneyimi için)
    setTimeout(() => {
        element.style.display = 'none';
        element.textContent = '';          // Mesajı temizle
    }, 5000);
}

// Çeşitli mesaj kutularını ve sonuç kutusunu gizlemek için fonksiyon.
// Genellikle yeni bir işlem başlatıldığında veya sayfa yüklendiğinde çağrılır.
function hideElements() {
    resultBox.style.display = 'none';      // Kısaltılmış link sonucu kutusunu gizle
    messageBox.style.display = 'none';     // Genel mesaj kutusunu gizle
    registerMessage.style.display = 'none';// Kayıt mesaj kutusunu gizle
    loginMessage.style.display = 'none';   // Giriş mesaj kutusunu gizle
    urlsMessageDiv.style.display = 'none'; // Link listesi mesaj kutusunu gizle
    urlsListDiv.innerHTML = '';            // Link listesini temizle
}

// Sayfa yüklendiğinde tüm mesaj kutularını ve sonuçları gizle.
// Bu, sayfa ilk açıldığında temiz bir görünüm sağlar.
window.onload = hideElements;


// --- Kimlik Doğrulama (Auth) İşlemleri ---

// "Giriş Yap" butonuna tıklandığında giriş formunu göster.
showLoginBtn.addEventListener('click', () => {
    loginForm.style.display = 'block';     // Giriş formunu görünür yap
    registerForm.style.display = 'none';   // Kayıt formunu gizle
    hideElements(); // Önceki mesajları temizle
});

// "Kayıt Ol" butonuna tıklandığında kayıt formunu göster.
showRegisterBtn.addEventListener('click', () => {
    registerForm.style.display = 'block';  // Kayıt formunu görünür yap
    loginForm.style.display = 'none';      // Giriş formunu gizle
    hideElements(); // Önceki mesajları temizle
});

// "Kayıt Ol" formundaki butona tıklandığında kullanıcı kaydı işlemini başlat.
registerBtn.addEventListener('click', async () => {
    const username = regUsername.value; // Kullanıcı adı al
    const email = regEmail.value;       // E-posta al
    const password = regPassword.value; // Şifre al

    try {
        // Backend'deki kayıt API'sine POST isteği gönderiyoruz.
        // URL: http://localhost:3000/api/register (Backend'deki rota ile eşleşmeli)
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST', // HTTP metodu
            headers: { 'Content-Type': 'application/json' }, // Gönderdiğimiz verinin JSON olduğunu belirt
            body: JSON.stringify({ username, email, password }) // Kullanıcı bilgilerini JSON string'i olarak gönder
        });

        const data = await response.json(); // Backend'den gelen JSON yanıtını ayrıştır

        if (response.ok) { // HTTP durumu 200-299 arasındaysa (başarılı yanıt)
            showMessage(registerMessage, '✅ Kayıt başarılı!', 'success'); // Başarı mesajı göster
            // Kayıt başarılı olduktan sonra form alanlarını temizle.
            regUsername.value = '';
            regEmail.value = '';
            regPassword.value = '';
        } else { // Başarısız yanıt (örn: 400, 409, 500)
            // Hata mesajını backend'den al, yoksa genel bir hata mesajı göster.
            showMessage(registerMessage, `❌ ${data.error || 'Kayıt sırasında hata oluştu.'}`, 'error');
        }
    } catch (error) {
        // Ağ hatası (örn: sunucu kapalıysa, bağlantı yoksa)
        console.error('Kayıt isteği sırasında hata:', error);
        showMessage(registerMessage, '❌ Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.', 'error');
    }
});

// "Giriş Yap" formundaki butona tıklandığında kullanıcı giriş işlemini başlat.
loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value;     // E-posta al
    const password = loginPassword.value; // Şifre al

    try {
        // Backend'deki giriş API'sine POST isteği gönderiyoruz.
        // URL: http://localhost:3000/api/login (Backend'deki rota ile eşleşmeli)
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) { // HTTP durumu 200-299 arasındaysa
            showMessage(loginMessage, '✅ Giriş başarılı!', 'success'); // Başarı mesajı göster
            localStorage.setItem('token', data.token); // Başarılı giriş sonrası alınan JWT'yi tarayıcının localStorage'ında sakla.
                                                     // Bu token, sonraki korumalı API isteklerinde kullanılacak.
            // Formu temizle
            loginEmail.value = '';
            loginPassword.value = '';

            // Başarılı giriş sonrası başka bir sayfaya yönlendirme (isteğe bağlı)
            // Eğer isterseniz, bu satırı yorum satırından çıkararak kullanıcıyı başka bir sayfaya yönlendirebilirsiniz.
            // window.location.href = 'shorten.html';
        } else { // Başarısız giriş
            showMessage(loginMessage, `❌ ${data.error || 'Giriş sırasında hata oluştu.'}`, 'error');
        }
    } catch (error) {
        // Ağ hatası
        console.error('Giriş isteği sırasında hata:', error);
        showMessage(loginMessage, '❌ Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.', 'error');
    }
});


// --- URL KISALTMA İŞLEMİ ---

// "Linkie'le!" Butonuna Tıklama Olayı Dinleyicisi
shortenBtn.addEventListener('click', async () => {
    console.log('1. Linkie! butonuna tıklandı.');
    const longUrl = longUrlInput.value.trim(); // Uzun URL'yi al ve boşlukları temizle

    // Önceki mesajları ve sonuçları temizle/gizle
    hideElements();
 console.log('2. Girilen URL:', longUrl);
    // URL boş mu kontrol et
    if (!longUrl) {
        showMessage(messageBox, 'Lütfen kısaltmak istediğiniz linki girin.', 'error');
        console.log('3. URL boş, işlem iptal edildi.');
        return;
    }

    // Basit bir URL formatı kontrolü: http:// veya https:// ile başlıyor mu?
    if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
        showMessage(messageBox, 'Lütfen geçerli bir URL girin (örn: http:// veya https:// ile başlamalı).', 'error');
        console.log('4. Geçersiz URL formatı, işlem iptal edildi.');
        return;
    }

    try {
        const token = localStorage.getItem('token'); // localStorage'dan JWT'yi al (giriş yaptıysa)
console.log('5. Token durumu:', token ? 'Token mevcut' : 'Token yok');
console.log('6. Backend API\'ye istek gönderiliyor...'); 
        // Backend API'ye İstek Gönderme (URL kısaltma)
        // URL: http://localhost:3000/api/shorten (Backend'deki rota ile eşleşmeli)
        const response = await fetch('http://localhost:3000/api/shorten', {
            method: 'POST', // HTTP metodu POST
            headers: {
                'Content-Type': 'application/json', // Gönderdiğimiz veri JSON formatında
                // Eğer token varsa, 'Authorization' başlığına 'Bearer [token]' formatında ekle.
                // Bu, backend'in kullanıcı kimliğini doğrulamasına yardımcı olur.
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({ longUrl: longUrl }), // Kısaltılacak URL'yi 'longUrl' anahtarıyla JSON olarak gönder
        });
        console.log('7. Backend\'den yanıt alındı, durum kodu:', response.status);

        const data = await response.json(); // Backend'den gelen JSON yanıtını ayrıştır
 console.log('8. Yanıt verisi:', data); 
        if (response.ok) { // HTTP durumu 200-299 arasındaysa (başarılı)
            shortenedLink.href = data.shortUrl;     // Kısaltılmış linkin href özelliğini ayarla
            shortenedLink.textContent = data.shortUrl; // Kısaltılmış linkin görünen metnini ayarla
            resultBox.style.display = 'block';      // Kısaltılmış linkin gösterileceği kutuyu görünür yap
             console.log('9. Link başarıyla kısaltıldı.');
            showMessage(messageBox, 'Linkiniz başarıyla kısaltıldı!', 'success'); // Başarı mesajı göster

            // Anonim kullanım hakkı güncellemesi (şimdilik bu kısım backend'de aktif değil, bu yüzden yorum satırında)
            // Backend'den 'remainingUses' gibi bir bilgi gelirse, bu satırı etkinleştirebilirsiniz.
            // if (data.remainingUses !== null && data.remainingUses !== undefined) {
            //     remainingUsesSpan.textContent = data.remainingUses;
            // }

            longUrlInput.value = ''; // Input alanını temizle

        } else { // Başarısız yanıt (örn: 400, 500)
            showMessage(messageBox, data.error || 'Link kısaltılırken bir hata oluştu.', 'error');
            console.log('10. Backend hata döndürdü:', data.error);
        }

    } catch (error) {
        // Ağ hatası
        console.error('API çağrısı sırasında hata:', error);
        console.log('11. API çağrısı sırasında bir JavaScript/Ağ hatası oluştu:', error.message);
        showMessage(messageBox, 'Sunucuya bağlanılamadı veya bir ağ hatası oluştu.', 'error');
    }
});

// Kısaltılmış Linki Kopyalama Fonksiyonu
copyButton.addEventListener('click', () => {
    const textToCopy = shortenedLink.textContent; // Kopyalanacak metni al
    // navigator.clipboard API'si ile metni panoya kopyala.
    // Bu modern ve güvenli bir yöntemdir.
    navigator.clipboard.writeText(textToCopy).then(() => {
        showMessage(messageBox, 'Link panoya kopyalandı!', 'success'); // Başarı mesajı
    }).catch(err => {
        // Kopyalama başarısız olursa (örn: tarayıcı izni yoksa)
        console.error('Kopyalama başarısız:', err);
        showMessage(messageBox, 'Link kopyalanamadı.', 'error');
    });
});


// --- "Linklerimi Göster" Butonu İçin ---
// Bu özellik, kullanıcının kaydettiği tüm linkleri backend'den çekip listelemek içindir.
// NOT: Bu endpoint (http://localhost:3000/api/urls) henüz backend'de tanımlı DEĞİL.
// Bu özelliği etkinleştirmek için backend'e (urlController ve index.js) yeni bir rota eklemeniz gerekecek.
listUrlsBtn.addEventListener('click', async () => {
    urlsListDiv.innerHTML = ''; // Listeyi temizle
    urlsMessageDiv.style.display = 'none'; // Mesajı gizle

    const token = localStorage.getItem('token'); // JWT'yi al

    // Kullanıcı giriş yapmamışsa, linklerini listeleyemez.
    if (!token) {
        showMessage(urlsMessageDiv, 'Linklerinizi görmek için giriş yapmalısınız.', 'error');
        return;
    }

    try {
        // Backend'deki /api/urls endpoint'ine GET isteği gönder
        // Authorization başlığına JWT'yi ekleyerek kullanıcının kimliğini doğrula.
        const response = await fetch('http://localhost:3000/api/urls', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json(); // Gelen JSON yanıtını ayrıştır

        if (response.ok) { // HTTP durumu 200-299 arasındaysa
            if (data.urls && data.urls.length > 0) {
                // Gelen her bir URL öğesi için HTML oluştur ve listeye ekle.
                data.urls.forEach(urlItem => {
                    const div = document.createElement('div');
                    div.className = 'url-item'; // CSS için sınıf ekle
                    div.innerHTML = `
                        <a href="${urlItem.shortUrl}" target="_blank">${urlItem.shortUrl}</a>
                        <span> -> </span>
                        <span class="original-url">${urlItem.longUrl}</span>
                        <span class="clicks">(${urlItem.clicks || 0} tıklama)</span>
                    `;
                    urlsListDiv.appendChild(div); // Listeye ekle
                });
            } else {
                showMessage(urlsMessageDiv, 'Kayıtlı linkiniz bulunmamaktadır.', 'info');
            }
        } else { // Başarısız yanıt
            showMessage(urlsMessageDiv, data.error || 'Linkleriniz getirilirken hata oluştu.', 'error');
        }
    } catch (error) {
        // Ağ hatası
        console.error('Link listesi isteği sırasında hata:', error);
        showMessage(urlsMessageDiv, 'Sunucuya bağlanılamadı veya bir ağ hatası oluştu.', 'error');
    }
});