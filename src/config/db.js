// src/config/db.js
//Veritabanı bağlantısı gibi yapılandırma dosyalarını içeriyor (db.js).
require('dotenv').config(); // gizli bilgileri .env dosyasından yükle

const { Pool } = require('pg'); //postgresgl ile konusacak aracı getir

const pool = new Pool({  //bu aracı nasıl kullanacagımızı ayarla
    user: process.env.DB_USER, //kullanıcı adı
    host: process.env.DB_HOST, //hangi bilgisayarda
    database: process.env.DB_DATABASE, //hangi veritabanına baglanacak
    password: process.env.DB_PASSWORD, //şifre ne
    port: process.env.DB_PORT, //hangi kapıdan
});

// Veritabanı bağlantısını test et
pool.connect() //bir veritabanına bağlanmayı deneylim 
    .then(() => console.log('PostgreSQL veritabanına başarıyla bağlandı.'))
    .catch(err => console.error('PostgreSQL veritabanına bağlanırken hata oluştu:', err.message));

module.exports = pool; //bu balantıyı baska dosyalarla da kullanabilmemiz için dışarıya aç