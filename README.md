# İK & Puantaj Yönetim Sistemi

Next.js 15, Tailwind CSS, Prisma ORM ve Neon PostgreSQL tabanlı İK ve Puantaj Yönetim Uygulaması.

---

## ⚡ Hızlı Başlangıç (Tak Çalıştır)

Veritabanı bulutta (Neon PostgreSQL) kurulu ve tüm çevre değişkenleri projeye dahil edilmiştir. Ek bir veritabanı kurulumu veya `.env` kopyalama işlemi gerekmez.

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```
*(Bu işlem Prisma istemcisini de otomatik olarak oluşturacaktır).*

### 2. Uygulamayı Başlatın
```bash
npm run dev
```

Tarayıcınızda **`http://localhost:3000`** adresine gidin. Sistem tüm verilerle birlikte doğrudan çalışmaya hazırdır!

---

## 🛠 Ek Komutlar (Gerekirse)
- `npx prisma studio` : Veritabanı tablolarını görsel arayüzde inceleme.
- `npm run db:seed` : Örnek şirket, şantiye ve personel verilerini yeniden yükleme.
- `npm run build` : Canlı üretim derlemesi testi.
