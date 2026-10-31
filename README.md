# Perde Vitrini

Evteks perde bölümü için Windows masaüstü uygulaması.

- **Örnek İşler:** Yapılmış işlerin fotoğrafları kategoriye göre. Fotoğrafa tıklayınca müşteriye tam ekran gösterim, ok tuşlarıyla geçiş.
- **Müşteri Ölçüleri:** Müşteri bilgisi, pencere en/boy ölçüleri, durum ve ölçü fotoğrafları.

## Kurulum

1. **Releases** bölümünden en son `Perde Vitrini Setup x.y.z.exe` dosyasını indir.
2. Çalıştır. Windows "bilinmeyen yayıncı" uyarısı verirse **Ek bilgi → Yine de çalıştır**.
3. Masaüstündeki **Perde Vitrini** kısayolundan aç.

## Veriler

Fotoğraflar ve kayıtlar varsayılan olarak `Belgeler\Perde Vitrini` klasöründe durur. İlk açılışta 67 örnek iş fotoğrafı otomatik gelir.

İki bilgisayar aynı verileri görsün istersen uygulamada **Ayarlar → Klasör değiştir** ile ortak bir klasör seç (ağ klasörü, Google Drive veya OneDrive klasörü).

Yedek almak için bu klasörü kopyalamak yeterli.

## Yeni sürüm çıkarmak

`package.json` içindeki `version` değerini artırıp `main` dalına gönder. GitHub Actions kurulum dosyasını üretip Releases'a ekler.
