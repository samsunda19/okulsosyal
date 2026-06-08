import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { SINIF_PLANLARI, DERS_BILGI } from "./yillikPlan";
import { tariheGoreHafta } from "./haftaTakvimi";

const AYLAR = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
const GUNLER = ["Pzt","Sal","Car","Per","Cum","Cmt","Paz"];
const GUN_ADI = ["Pazar","Pazartesi","Sali","Carsamba","Persembe","Cuma","Cumartesi"];

// tarih -> "YYYY-MM-DD"
const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";

function gunKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function Takvim({ ogretmenIsmi, ogretmenUid }) {
  const bugun = new Date();
  const [ay, setAy] = useState(bugun.getMonth());
  const [yil, setYil] = useState(bugun.getFullYear());
  const [seciliGun, setSeciliGun] = useState(null); // Date
  const [dersProgramlari, setDersProgramlari] = useState({}); // {sinif: {0:[{ders,saat}],...}} sinif bazli, 0=Pzt
  const [secilenSinif, setSecilenSinif] = useState(4); // aktif sinif seviyesi (simdilik sadece 4 secilebilir)
  const [notlar, setNotlar] = useState({}); // {"2026-06-09":"metin"}
  const [programAcik, setProgramAcik] = useState(false);
  const [acikDers, setAcikDers] = useState(null); // dersKey
  const [icerikAcik, setIcerikAcik] = useState(false);
  const [notYaziliyor, setNotYaziliyor] = useState(false);
  const [notMetin, setNotMetin] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  // AI uretim - tur bazli (anlatim, sorular, odev, ekSorular)
  const [aiIcerik, setAiIcerik] = useState({}); // {anlatim:"...", sorular:"...", ...}
  const [aiYukleniyorTur, setAiYukleniyorTur] = useState(null); // hangi tur uretiliyor
  const [aiHata, setAiHata] = useState("");
  const [ekPaylasildi, setEkPaylasildi] = useState(false);
  const [ogretmenNotu, setOgretmenNotu] = useState("");
  const [acikTur, setAcikTur] = useState(null); // hangi AI turu icerik acik
  // Icerik Havuzu
  const [duzenlenenTur, setDuzenlenenTur] = useState(null); // hangi tur duzenleniyor
  const [duzenMetin, setDuzenMetin] = useState(""); // duzenleme kutusu metni
  const [havuzaEklendi, setHavuzaEklendi] = useState({}); // {tur: true}
  const [havuzAcik, setHavuzAcik] = useState(false); // havuzdan indir paneli acik mi
  const [havuzListe, setHavuzListe] = useState({}); // {tur: [icerikler]}
  const [havuzYukleniyor, setHavuzYukleniyor] = useState(false);
  const [havuzSeciliTur, setHavuzSeciliTur] = useState("anlatim"); // havuz modalinda secili tur
  const [havuzSeciliItem, setHavuzSeciliItem] = useState(null); // havuz modalinda secili icerik (onizlenen)

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "ogretmenTakvim", ogretmenUid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          // Yeni yapi: dersProgramlari (sinif bazli). Eski duz dersProgrami varsa 4. sinif sayilir.
          if (d.dersProgramlari) setDersProgramlari(d.dersProgramlari);
          else if (d.dersProgrami) setDersProgramlari({ 4: d.dersProgrami });
          if (d.sinif) setSecilenSinif(d.sinif);
          setNotlar(d.notlar || {});
        }
      } catch (e) { console.error(e); }
      setYukleniyor(false);
      // Acilista bugunu sec (otomatik)
      setSeciliGun(new Date());
    })();
  }, [ogretmenUid]);

  const takvimKaydet = async (yeniProgram, yeniNotlar, yeniSinif) => {
    try {
      const ref = doc(db, "ogretmenTakvim", ogretmenUid);
      await setDoc(ref, {
        dersProgramlari: yeniProgram !== undefined ? yeniProgram : dersProgramlari,
        sinif: yeniSinif !== undefined ? yeniSinif : secilenSinif,
        notlar: yeniNotlar !== undefined ? yeniNotlar : notlar,
        guncelleme: serverTimestamp()
      }, { merge: true });
    } catch (e) { alert("Kaydedilemedi: " + e.message); }
  };

  // ===== Ders programi tablo =====
  // dersProgrami formati: {gun: [{ders, saat}, ...]} - tabloda saat=satir indeksi
  // Tablo gosterimi icin: gun+saat -> ders adi
  const [tabloTaslak, setTabloTaslak] = useState(null);
  const tabloDeger = (gun, saat) => {
    const kaynak = tabloTaslak || (dersProgramlari[secilenSinif] || {});
    const liste = kaynak[gun] || [];
    return liste[saat] ? liste[saat].ders : "";
  };
  const tabloDegistir = (gun, saat, deger) => {
    const taslak = tabloTaslak || JSON.parse(JSON.stringify(dersProgramlari[secilenSinif] || {}));
    if (!taslak[gun]) taslak[gun] = [];
    while (taslak[gun].length <= saat) taslak[gun].push({ ders: "", saat: "1" });
    taslak[gun][saat] = { ders: deger, saat: "1" };
    setTabloTaslak({ ...taslak });
  };
  const tabloyuKaydet = () => {
    const kaynak = tabloTaslak || (dersProgramlari[secilenSinif] || {});
    // Bos dersleri temizle (sondan), her gun icin ardisik dolu dersleri tut
    const temiz = {};
    for (let g = 0; g < 5; g++) {
      const liste = (kaynak[g] || []).filter(d => d.ders && d.ders.trim());
      if (liste.length) temiz[g] = liste;
    }
    // Sadece aktif sinifin programini guncelle, diger siniflar korunur
    const yeni = { ...dersProgramlari, [secilenSinif]: temiz };
    setDersProgramlari(yeni);
    setTabloTaslak(null);
    takvimKaydet(yeni);
    alert("Ders programi kaydedildi!");
  };

  // ===== Not =====
  const notKaydet = async () => {
    if (!seciliGun) return;
    const k = gunKey(seciliGun);
    const guncel = { ...notlar };
    if (notMetin.trim()) guncel[k] = notMetin.trim();
    else delete guncel[k];
    setNotlar(guncel);
    setNotYaziliyor(false);
    takvimKaydet(undefined, guncel);
  };

  // ===== Takvim grid hesapla =====
  const ilkGun = new Date(yil, ay, 1);
  const ilkGunHafta = (ilkGun.getDay() + 6) % 7; // Pzt=0
  const ayGunSayisi = new Date(yil, ay + 1, 0).getDate();
  const kareler = [];
  for (let i = 0; i < ilkGunHafta; i++) kareler.push(null);
  for (let g = 1; g <= ayGunSayisi; g++) kareler.push(new Date(yil, ay, g));

  const ayDegistir = (yon) => {
    let ya = ay + yon, yy = yil;
    if (ya < 0) { ya = 11; yy--; } if (ya > 11) { ya = 0; yy++; }
    setAy(ya); setYil(yy);
  };

  const gunSec = (d) => {
    setSeciliGun(d);
    setAcikDers(null);
    setIcerikAcik(false);
    setNotYaziliyor(false);
    setAiIcerik({}); setAiHata(""); setEkPaylasildi(false);
    setNotMetin(notlar[gunKey(d)] || "");
  };

  // Secili gunun bilgisi
  let secilenHaftaBilgi = null, secilenDersler = [], secilenGunIdx = 0, planVarMi = false;
  if (seciliGun) {
    secilenGunIdx = (seciliGun.getDay() + 6) % 7; // Pzt=0
    secilenHaftaBilgi = tariheGoreHafta(seciliGun);
    if (secilenHaftaBilgi && secilenHaftaBilgi.haftaNo) {
      planVarMi = true;
      secilenDersler = (dersProgramlari[secilenSinif] || {})[secilenGunIdx] || [];
    }
  }

  // Ders adindan yillikPlan key bul (ad eslestirme)
  const dersKeyBul = (dersAd) => {
    const ad = dersAd.toLowerCase();
    for (const [key, bilgi] of Object.entries(DERS_BILGI)) {
      if (bilgi.ad.toLowerCase() === ad || ad.includes(bilgi.ad.toLowerCase()) || bilgi.ad.toLowerCase().includes(ad)) return key;
    }
    return null;
  };

  const dersPlanBilgisi = (dersAd) => {
    if (!secilenHaftaBilgi || !secilenHaftaBilgi.haftaNo) return null;
    const key = dersKeyBul(dersAd);
    if (!key) return null;
    const plan = (SINIF_PLANLARI[secilenSinif] || {})[secilenHaftaBilgi.haftaNo];
    return plan ? plan[key] : null;
  };

  // ===== AI icerik anahtari (tarih + ders + tur) =====
  const icerikAnahtar = (dersAd, tur) => {
    if (!seciliGun) return null;
    // 4. sinif eski format (geriye uyumluluk), diger siniflar ayri anahtar alir
    const sinifEk = secilenSinif === 4 ? "" : ("_s" + secilenSinif);
    return ogretmenUid + "_" + gunKey(seciliGun) + "_" + dersAd.replace(/\s/g, "") + "_" + tur + sinifEk;
  };

  // Secili ders acildiginda kayitli icerikleri Firebase'den cek
  const kayitliIcerikCek = async (dersAd) => {
    const turler = ["anlatim", "sorular", "odev", "ekSorular"];
    const sonuc = {};
    for (const tur of turler) {
      try {
        const anahtar = icerikAnahtar(dersAd, tur);
        if (!anahtar) continue;
        const snap = await getDoc(doc(db, "ogretmenIcerik", anahtar));
        if (snap.exists()) sonuc[tur] = snap.data().metin;
      } catch (e) { /* yoksa gec */ }
    }
    setAiIcerik(sonuc);
  };

  // ===== Tek bir tur uret (AI) =====
  const TUR_BILGI = {
    anlatim: {
      ad: "Konu Anlatimi (Ogretmen Kilavuzu)",
      rol: "Sen 20 yillik deneyimli bir sinif ogretmenisin ve yeni mezun ogretmenlere mentorluk yapiyorsun. Bir konuyu sinifta nasil anlatacaklarini, hangi gunluk hayat orneklerini verecekleri, hangi sorulari soracaklari ve nelere dikkat edecekleri konusunda onlara adim adim yol gosterirsin. Amacin, deneyimsiz bir ogretmenin eline alip 'iste boyle anlat' diyebilecegi net, dolu ve uygulanabilir bir kilavuz vermek.",
      talimat: "Ogretmenin sinifta bu konuyu ADIM ADIM nasil anlatacagina dair detayli bir KILAVUZ hazirla. Su yapida olsun: (1) Derse giris/dikkat cekme onerisi, (2) Konuyu acmak icin gunluk hayattan SOMUT, karsilastirmali ornekler, (3) Ogretmenin sinifta sorabilecegi sorular, (4) Yapilabilecek basit etkinlik/gosterim onerisi, (5) Cocuklarin sik yaptigi kavram yanilgilari ve nasil duzeltilecegi. Dolu, gercekten yol gosteren bir metin olsun. En az 4-5 paragraf."
    },
    sorular: {
      ad: "Sinif Sorulari",
      rol: "Sen olcme ve degerlendirme uzmani, hazirladigi sorular egitim dergilerinde yayinlanan cok deneyimli bir sinif ogretmenisin. Kazanima tam uygun, kolaydan zora siralanmis, secenekleri/celdiricileri ozenli, seviyeye uygun ve ogrenciyi dusunduren sorular hazirlarsin.",
      talimat: "Konuyla ilgili 10 adet sinif ici soru hazirla. Kolaydan zora siralanmis, numarali. Cesitli olsun (bosluk doldurma, problem, kisa cevap, eslestirme). Sonunda mutlaka 'CEVAP ANAHTARI' basligi ile cevaplari ekle. Sorular kisa ve net olsun, gereksiz uzatma. Tum sorular 2 sayfaya rahatca sigacak kadar derli toplu olsun."
    },
    odev: {
      ad: "Ev Odevi",
      rol: "Sen velilerin ve ogrencilerin cok sevdigi, odevleri hem ogretici hem sikmadan hazirlayan deneyimli bir sinif ogretmenisin. Cocugun evde tek basina, keyifle yapabilecegi, konuyu pekistiren odevler hazirlarsin.",
      talimat: "Ev odevi olarak 10 adet alistirma hazirla. Kolaydan zora, numarali, cocugun evde tek basina yapabilecegi seviyede. Cesitli soru tipleri kullan. Sonunda mutlaka 'CEVAP ANAHTARI' basligi ile cevaplari ekle. Sorular kisa ve net olsun, gereksiz uzatma. Tum sorular 2 sayfaya rahatca sigacak kadar derli toplu olsun."
    },
    ekSorular: {
      ad: "Uygulama Sorulari",
      rol: "Sen cocuklarin telefon/tablet uzerinden cozmekten keyif aldigi, kisa ve net sorular hazirlayan deneyimli bir sinif ogretmenisin. Sade, anlasilir, cocugun ekrandan okuyup defterine cozebilecegi sorular yazarsin.",
      talimat: "Cocuklarin telefonda/ekrandan gorecegi 10 adet kisa, net soru/problem hazirla. SADECE sorular, numarali (1. 2. 3. ...), alt alta, cok sade dil. O gun sinifta verilenlerden FARKLI, ayni konuda taze sorular. Cevap anahtari EKLEME (cocuk gorecek)."
    }
  };

  // Turkce dersinde kazanim turune gore ozel yonlendirme
  const turkceEkKural = (dersAd, kazanimMetni) => {
    if (!dersAd.toLowerCase().includes("turkce")) return "";
    const k = kazanimMetni.toLowerCase();
    const yazma = k.includes("yaz") || k.includes("siir") || k.includes("hikaye") || k.includes("metin olus") || k.includes("gunluk") || k.includes("ani");
    const okumaDinleme = k.includes("oku") || k.includes("dinle") || k.includes("metin") || k.includes("anla");
    if (yazma) return "\nONEMLI (Turkce-Yazma): Bu bir yazma kazanimi. Cocuga YAZABILECEGI bir gorev/yonerge ver (orn: belirli konuda kisa metin/siir/hikaye yazma). Noktalama isaretlerine ve imla kurallarina dikkat etmesini hatirlat. Ornek bir kisa metin de gosterebilirsin.";
    if (okumaDinleme) return "\nONEMLI (Turkce-Okuma/Dinleme): Bu bir okuma/dinleme kazanimi. ONCE konuya uygun KISA bir metin/hikaye olustur (cocuk seviyesinde), SONRA tum sorulari/calismayi bu metne bagla. Metni en uste yaz, sorulari metne gore sor.";
    return "";
  };

  const aiUretTur = async (dersAd, plan, tur) => {
    setAiYukleniyorTur(tur); setAiHata("");
    const kazanimMetni = plan.kazanimlar.map(k => k.kod + " - " + k.aciklama).join("; ");
    const tb = TUR_BILGI[tur];
    const ekKural = turkceEkKural(dersAd, kazanimMetni);
    const sistemPrompt = tb.rol + " KESINLIKLE 4. sinif (9-10 yas, ilkokul) seviyesinde calisirsin: dil sade, sorular basit ve somut olmali. Ortaokul/lise kavramlari KULLANMA. Ilkokulda olmayan arac-gerec verme (ornegin desimetre, hassas terazi gibi). Sadece 4. sinif ogrencisinin bildigi birimleri ve kavramlari kullan. Turkce karakterleri dogru kullanirsin (ç, ş, ğ, ı, ö, ü). COK ONEMLI BICIM KURALI: DUZ METIN yaz, Markdown/bicimlendirme isareti KULLANMA. Asla #, ##, ###, **, ---, *, > gibi isaretler koyma. Baslik gerekiyorsa duz yaz (orn: '1. Soru' de, '**1. Soru**' deme). Soru numaralarini '1.', '2.' seklinde duz yaz. Sadece istenen icerigi uretirsin, gereksiz aciklama eklemezsin.";
    const prompt = `Ders: ${dersAd}
Konu: ${plan.konu}
Kazanim(lar): ${kazanimMetni}

GOREV: ${tb.talimat}${ekKural}

Yukaridaki kazanima SIKI SIKIYA bagli kal. Konu disina cikma. Icerigi dogrudan uret.`;

    try {
      const response = await fetch(WORKER_URL + "/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + await auth.currentUser.getIdToken()
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3000,
          system: sistemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      if (data.error) { setAiHata(data.error.message || "AI hatasi"); setAiYukleniyorTur(null); return; }
      const metin = (data.content && data.content[0] && data.content[0].text) ? markdownTemizle(data.content[0].text.trim()) : "";
      setAiIcerik(prev => ({ ...prev, [tur]: metin }));
      setAcikTur(tur);
      // Firebase'e kaydet (tekrar uretmemek icin)
      const anahtar = icerikAnahtar(dersAd, tur);
      if (anahtar) {
        await setDoc(doc(db, "ogretmenIcerik", anahtar), {
          metin, ders: dersAd, tur, tarih: gunKey(seciliGun), ogretmenUid, guncelleme: serverTimestamp()
        });
      }
    } catch (e) {
      setAiHata("Uretilemedi: " + e.message);
    }
    setAiYukleniyorTur(null);
  };

  // ===== PDF indir (basit, yazdir penceresi) =====
  // Markdown isaretlerini temizle (#, **, ---, * vb. duz metne cevir)
  const markdownTemizle = (metin) => {
    if (!metin) return "";
    return metin
      .replace(/^\s*#{1,6}\s*/gm, "")        // ### basliklar
      .replace(/\*\*(.*?)\*\*/g, "$1")        // **kalin**
      .replace(/\*(.*?)\*/g, "$1")            // *italik*
      .replace(/^\s*[-*]{3,}\s*$/gm, "")      // --- *** ayraclar
      .replace(/^\s*>\s?/gm, "")              // > alinti
      .replace(/`([^`]*)`/g, "$1")            // `kod`
      .replace(/\n{3,}/g, "\n\n");            // 3+ bos satiri 2'ye indir
  };

  const wordIndir = (baslik, icerik, dersAd2, konu2) => {
    icerik = markdownTemizle(icerik);
    const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Cevap anahtarini ayir (varsa)
    let sorularKismi = icerik, cevapKismi = "";
    const m = icerik.search(/CEVAP\s*ANAHTARI/i);
    if (m !== -1) {
      sorularKismi = icerik.slice(0, m).trim();
      cevapKismi = icerik.slice(m).replace(/CEVAP\s*ANAHTARI[:\s]*/i, "").trim();
    }
    const ustBilgi = (dersAd2 ? esc(dersAd2) : "") + (konu2 ? " - " + esc(konu2) : "");
    const cevapHtml = cevapKismi ? `
      <br clear="all" style="page-break-before:always" />
      <h1>Cevap Anahtari</h1>
      <p class="ust">${ustBilgi}</p>
      <p class="govde">${esc(cevapKismi).replace(/\n/g, "<br/>")}</p>` : "";
    // Word'un anladigi HTML (.doc) formati
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${esc(baslik)}</title>
      <style>
        @page { margin: 1.4cm 1.6cm; }
        body { font-family: "Calibri", Arial, sans-serif; color: #1a1a2e; font-size: 11pt; }
        h1 { font-size: 14pt; color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 3px; margin: 0 0 2px; }
        .ust { font-size: 9pt; color: #4f46e5; font-weight: bold; margin: 1px 0 4px; }
        .adsoyad { font-size: 10pt; color: #555; margin: 4px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .govde { font-size: 11pt; line-height: 1.45; }
      </style></head>
      <body>
        <h1>${esc(baslik)}</h1>
        <p class="ust">${ustBilgi}</p>
        <p class="adsoyad">Ad Soyad: ______________________&nbsp;&nbsp;&nbsp;&nbsp;Tarih: ____________</p>
        <p class="govde">${esc(sorularKismi).replace(/\n/g, "<br/>")}</p>
        ${cevapHtml}
      </body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const dosyaAd = (baslik + (konu2 ? " - " + konu2 : "")).replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ ]/g, "").trim() + ".doc";
    const a = document.createElement("a");
    a.href = url;
    a.download = dosyaAd;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ===== Ek sorulari paylas (cocuk ekrandan gorur) =====
  const ekSorulariPaylas = async (dersAd) => {
    if (!aiIcerik.ekSorular) return;
    try {
      const konuMetni = (dersPlanBilgisi(dersAd)?.konu) || "";
      const notVar = ogretmenNotu.trim();
      await addDoc(collection(db, "duyurular"), {
        icerik: "📱 " + dersAd + " - Uygulama Sorulari\n" + (konuMetni ? "(" + konuMetni + ")\n" : "") + (notVar ? "\n📝 " + notVar + "\n" : "") + "\n" + aiIcerik.ekSorular,
        tip: "uygulamaSorusu",
        dersAd: dersAd,
        sorular: aiIcerik.ekSorular,
        konu: konuMetni,
        ogretmenNotu: notVar || null,
        yazar: ogretmenIsmi, yazarUid: ogretmenUid,
        tarih: serverTimestamp(), begenenler: [], fotoUrl: null, adminSildi: false
      });
      setEkPaylasildi(true);
      setOgretmenNotu("");
    } catch (e) { alert("Paylasilamadi: " + e.message); }
  };

  // ===== ICERIK HAVUZU =====
  // Log helper (best-effort: Worker /log)
  const havuzLog = async (islem, detay) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(WORKER_URL + "/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ islem, detay, uid: ogretmenUid })
      });
    } catch (e) { /* log basarisiz olsa da islem akar */ }
  };

  // Bir turun kazanim kodunu al (havuz anahtari icin)
  const kazanimKoduAl = (plan) => (plan && plan.kazanimlar && plan.kazanimlar[0]) ? plan.kazanimlar[0].kod : "GENEL";

  // Duzenlemeyi baslat
  const duzenleBaslat = (tur) => {
    setDuzenlenenTur(tur);
    setDuzenMetin(aiIcerik[tur] || "");
  };
  // Duzenlemeyi kaydet (yerel aiIcerik'e)
  const duzenleKaydet = (tur) => {
    setAiIcerik(prev => ({ ...prev, [tur]: duzenMetin }));
    setDuzenlenenTur(null);
  };

  // Havuza ekle (duzenlenmis/uretilmis icerigi paylasimli havuza)
  const havuzaEkle = async (dersAd, plan, tur) => {
    const metin = aiIcerik[tur];
    if (!metin || !metin.trim()) return;
    const kod = kazanimKoduAl(plan);
    try {
      const ref = await addDoc(collection(db, "icerikHavuzu"), {
        kazanimKod: kod,
        tur: tur,
        ders: dersAd,
        konu: plan.konu || "",
        metin: metin,
        ekleyenUid: ogretmenUid,
        ekleyenIsim: ogretmenIsmi,
        tarih: serverTimestamp(),
        sonDuzenleme: serverTimestamp()
      });
      setHavuzaEklendi(prev => ({ ...prev, [tur]: true }));
      const turAdi = { anlatim: "Konu Anlatimi", sorular: "Sinif Sorulari", odev: "Ev Odevi", ekSorular: "Uygulama Sorulari" }[tur] || tur;
      const mail = auth.currentUser.email || "";
      havuzLog("havuz_ekle", ogretmenIsmi + " (" + mail + ") havuza ekledi -> " + dersAd + " / " + kod + " / " + turAdi + " [id:" + ref.id + "]");
    } catch (e) { alert("Havuza eklenemedi: " + e.message); }
  };

  // Havuzdan o kazanima ait icerikleri cek
  const havuzdanCek = async (plan) => {
    setHavuzYukleniyor(true);
    const kod = kazanimKoduAl(plan);
    try {
      const q = query(collection(db, "icerikHavuzu"), where("kazanimKod", "==", kod));
      const snap = await getDocs(q);
      const hepsi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ture gore grupla
      const grup = { anlatim: [], sorular: [], odev: [], ekSorular: [] };
      hepsi.forEach(it => { if (grup[it.tur]) grup[it.tur].push(it); });
      // Her grubu en yeniden eskiye sirala
      Object.keys(grup).forEach(t => grup[t].sort((a,b) => (b.tarih?.seconds||0)-(a.tarih?.seconds||0)));
      setHavuzListe(grup);
    } catch (e) { alert("Havuz yuklenemedi: " + e.message); setHavuzListe({}); }
    setHavuzYukleniyor(false);
  };

  // Havuzdaki kendi icerigini sil
  const havuzSil = async (havuzId, tur) => {
    if (!window.confirm("Bu havuz icerigini silmek istiyor musun?")) return;
    try {
      await deleteDoc(doc(db, "icerikHavuzu", havuzId));
      setHavuzListe(prev => ({ ...prev, [tur]: (prev[tur]||[]).filter(x => x.id !== havuzId) }));
      const mail2 = auth.currentUser.email || "";
      havuzLog("havuz_sil", ogretmenIsmi + " (" + mail2 + ") havuzdan sildi [id:" + havuzId + "]");
    } catch (e) { alert("Silinemedi: " + e.message); }
  };

  // Havuzdaki icerigi uygulamada paylas (uygulama sorusu ise)
  const havuzdanPaylas = async (item) => {
    try {
      await addDoc(collection(db, "duyurular"), {
        icerik: "📱 " + item.ders + " - Uygulama Sorulari\n" + (item.konu ? "(" + item.konu + ")\n" : "") + "\n" + item.metin,
        tip: "uygulamaSorusu",
        dersAd: item.ders,
        sorular: item.metin,
        konu: item.konu || "",
        ogretmenNotu: null,
        yazar: ogretmenIsmi, yazarUid: ogretmenUid,
        tarih: serverTimestamp(), begenenler: [], fotoUrl: null, adminSildi: false
      });
      alert("✓ Uygulamada paylasildi!");
    } catch (e) { alert("Paylasilamadi: " + e.message); }
  };

  const kart = "#1a1a2e", kart2 = "#252538", yazi = "#f0e6d3", ikincil = "#888";

  // Metni A4 sayfalara bol (onizleme icin)
  const a4Sayfalara = (metin) => {
    const satirlar = (metin || "").split("\n");
    const sayfalar = [];
    let buSayfaSatir = [], buSayir = 0;
    const MAX = 50;
    for (const s of satirlar) {
      const yuk = Math.max(1, Math.ceil(s.length / 95));
      if (buSayir + yuk > MAX && buSayfaSatir.length > 0) {
        sayfalar.push(buSayfaSatir.join("\n")); buSayfaSatir = []; buSayir = 0;
      }
      buSayfaSatir.push(s); buSayir += yuk;
    }
    if (buSayfaSatir.length) sayfalar.push(buSayfaSatir.join("\n"));
    if (sayfalar.length === 0) sayfalar.push("");
    return sayfalar;
  };
  const A4Onizleme = ({ metin }) => {
    const sayfalar = a4Sayfalara(metin);
    return sayfalar.map((sayfa, i) => (
      <div key={i} style={{ position: "relative", background: "#fff", maxWidth: "21cm", margin: "0 auto 16px", padding: "2cm 1.8cm", minHeight: "27cm", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", fontFamily: "Calibri, Arial, sans-serif", color: "#1a1a2e", fontSize: "12pt", lineHeight: 1.5, whiteSpace: "pre-wrap", boxSizing: "border-box" }}>
        {sayfa || <span style={{ color: "#bbb" }}>(bos)</span>}
        <div style={{ position: "absolute", bottom: "0.8cm", right: "1.8cm", color: "#999", fontSize: "9pt" }}>Sayfa {i+1} / {sayfalar.length}</div>
      </div>
    ));
  };

  if (yukleniyor) return <p style={{ color: ikincil, textAlign: "center", padding: "20px", fontFamily: "Georgia, serif" }}>Takvim yukleniyor...</p>;

  return (
    <div style={{ fontFamily: "Georgia, serif", width: "100%", maxWidth: "760px", margin: "0 auto" }}>

      {/* ===== SINIF SECICI ===== */}
      <div style={{ background: kart, borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
        <div style={{ color: yazi, fontSize: "13px", fontWeight: "600", marginBottom: "10px" }}>Lutfen sinifinizi seciniz</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3, 4].map(s => {
            const aktif = s === 4; // simdilik sadece 4. sinif planlari yuklu
            const secili = secilenSinif === s;
            return (
              <button key={s} disabled={!aktif}
                onClick={() => { if (!aktif) return; setSecilenSinif(s); setTabloTaslak(null); setAcikDers(null); takvimKaydet(undefined, undefined, s); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: "9px", position: "relative", fontSize: "15px", fontWeight: "600",
                  cursor: aktif ? "pointer" : "not-allowed", opacity: aktif ? 1 : 0.4,
                  background: secili ? "#4f46e5" : (aktif ? "#15151f" : "#101018"),
                  color: secili ? "#fff" : (aktif ? yazi : "#555"),
                  border: secili ? "2px solid #818cf8" : "1px solid #2a2a3e" }}>
                {s}. Sinif
                {!aktif && <span style={{ position: "absolute", top: "3px", right: "5px", fontSize: "8px", color: "#777", fontWeight: "400" }}>Yakinda</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== TAKVIM ===== */}
      <div style={{ background: kart, borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <button onClick={() => ayDegistir(-1)} style={{ background: "none", border: "none", color: ikincil, fontSize: "20px", cursor: "pointer" }}>‹</button>
          <span style={{ color: yazi, fontSize: "16px", fontWeight: "600" }}>{AYLAR[ay]} {yil}</span>
          <button onClick={() => ayDegistir(1)} style={{ background: "none", border: "none", color: ikincil, fontSize: "20px", cursor: "pointer" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px", marginBottom: "6px" }}>
          {GUNLER.map((g, i) => <div key={g} style={{ textAlign: "center", color: i > 4 ? "#555" : "#666", fontSize: "10px" }}>{g}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px" }}>
          {kareler.map((d, i) => {
            if (!d) return <div key={"b"+i} />;
            const hb = tariheGoreHafta(d);
            const tatil = hb && hb.tatil;
            const haftaSonu = (d.getDay() === 0 || d.getDay() === 6);
            const secili = seciliGun && gunKey(seciliGun) === gunKey(d);
            const buGun = gunKey(d) === gunKey(bugun);
            const notVar = !!notlar[gunKey(d)];
            return (
              <div key={gunKey(d)} onClick={() => gunSec(d)}
                style={{ height: "40px", borderRadius: "7px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative",
                  background: secili ? "#4f46e5" : (tatil ? "#3b1f1f" : (haftaSonu ? "#101018" : "#15151f")),
                  border: secili ? "2px solid #818cf8" : (buGun ? "1px solid #06b6d4" : "none"),
                  color: secili ? "#fff" : (tatil ? "#f59e0b" : (haftaSonu ? "#555" : "#aaa")), fontSize: "12px" }}>
                {d.getDate()}
                {notVar && <span style={{ position: "absolute", bottom: "3px", width: "4px", height: "4px", background: "#f59e0b", borderRadius: "50%" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== DERS PROGRAMI (akordiyon) ===== */}
      <div style={{ background: kart, borderRadius: "12px", marginBottom: "12px", overflow: "hidden" }}>
        <div onClick={() => setProgramAcik(!programAcik)} style={{ padding: "12px 16px", background: kart2, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ color: yazi, fontSize: "13px", fontWeight: "600" }}>⚙️ Ders Programim</span>
          <span style={{ color: "#818cf8", fontSize: "13px" }}>{programAcik ? "▾" : "▸"}</span>
        </div>
        {programAcik && (
          <div style={{ padding: "12px 16px" }}>
            <div style={{ color: ikincil, fontSize: "11px", marginBottom: "10px" }}>Her gun icin ders saatlerini sec. Bos birak istersen. Sonunda kaydet.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "5px", color: ikincil, fontSize: "10px", borderBottom: "1px solid #333" }}>Saat</th>
                    {GUN_ADI.slice(1,6).map((g, i) => <th key={i} style={{ padding: "5px", color: "#c8bfb0", fontSize: "10px", borderBottom: "1px solid #333" }}>{g}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[0,1,2,3,4,5].map(saat => (
                    <tr key={saat}>
                      <td style={{ padding: "3px", color: ikincil, fontSize: "10px", textAlign: "center" }}>{saat+1}.</td>
                      {[0,1,2,3,4].map(gun => (
                        <td key={gun} style={{ padding: "2px" }}>
                          <select value={tabloDeger(gun, saat)} onChange={e => tabloDegistir(gun, saat, e.target.value)}
                            style={{ width: "100%", padding: "5px 2px", background: "#15151f", color: yazi, border: "1px solid #2a2a3e", borderRadius: "5px", fontSize: "10px" }}>
                            <option value="">—</option>
                            {Object.entries(DERS_BILGI).map(([k, b]) => <option key={k} value={b.ad}>{b.ad}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={tabloyuKaydet} style={{ width: "100%", padding: "10px", marginTop: "12px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              💾 Programi Kaydet
            </button>
          </div>
        )}
      </div>

      {/* ===== SECILEN GUN (akordiyon) ===== */}
      {seciliGun && (
        <div style={{ background: kart, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: kart2 }}>
            <span style={{ color: yazi, fontSize: "14px", fontWeight: "600" }}>
              📆 {seciliGun.getDate()} {AYLAR[seciliGun.getMonth()]} {GUN_ADI[seciliGun.getDay()]}
              {secilenHaftaBilgi && secilenHaftaBilgi.haftaNo && <span style={{ color: "#06b6d4", fontSize: "11px" }}> · {secilenHaftaBilgi.haftaNo}. hafta</span>}
            </span>
          </div>

          {/* Tatil mi / hafta sonu mu / normal mi */}
          {secilenHaftaBilgi && secilenHaftaBilgi.tatil ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#f59e0b", fontSize: "14px" }}>🌴 {secilenHaftaBilgi.tatil}</div>
          ) : !planVarMi ? (
            <div style={{ padding: "20px", textAlign: "center", color: ikincil, fontSize: "13px" }}>Bu gun icin ders plani yok (hafta sonu veya egitim disi).</div>
          ) : (
            <>
              {/* NOT */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #15151f" }}>
                {!notYaziliyor ? (
                  <div onClick={() => { setNotYaziliyor(true); setNotMetin(notlar[gunKey(seciliGun)] || ""); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <span style={{ color: "#fbbf24", fontSize: "13px" }}>📝 {notlar[gunKey(seciliGun)] ? notlar[gunKey(seciliGun)] : "Bu gune not ekle"}</span>
                    <span style={{ color: ikincil, fontSize: "12px" }}>{notlar[gunKey(seciliGun)] ? "duzenle" : "+ ekle"}</span>
                  </div>
                ) : (
                  <div>
                    <textarea value={notMetin} onChange={e => setNotMetin(e.target.value)} placeholder="Notunu yaz..." rows={2}
                      style={{ width: "100%", padding: "8px 10px", background: "#15151f", color: yazi, border: "1px solid #333", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", fontFamily: "Georgia, serif", resize: "vertical" }} />
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <button onClick={notKaydet} style={{ padding: "6px 14px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", cursor: "pointer" }}>Kaydet</button>
                      <button onClick={() => setNotYaziliyor(false)} style={{ padding: "6px 14px", background: "#252538", color: ikincil, border: "none", borderRadius: "7px", fontSize: "12px", cursor: "pointer" }}>Iptal</button>
                    </div>
                  </div>
                )}
              </div>

              {/* DERSLER */}
              <div style={{ padding: "10px 16px" }}>
                <div style={{ color: ikincil, fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>Bugunun Dersleri</div>
                {secilenDersler.length === 0 ? (
                  <div style={{ color: ikincil, fontSize: "12px", padding: "8px 0" }}>Bu gune ders eklenmemis. Yukaridan "Ders Programim" ile ekleyebilirsin.</div>
                ) : secilenDersler.map((dItem, di) => {
                  const plan = dersPlanBilgisi(dItem.ders);
                  const acik = acikDers === di;
                  const ikon = (() => { const k = dersKeyBul(dItem.ders); return k ? DERS_BILGI[k].ikon : "📓"; })();
                  return (
                    <div key={di} style={{ background: kart2, borderRadius: "9px", marginBottom: "7px", overflow: "hidden", border: acik ? "1px solid #3730a3" : "none" }}>
                      <div onClick={() => { const yeniAcik = acik ? null : di; setAcikDers(yeniAcik); setIcerikAcik(false); setHavuzAcik(false); setHavuzSeciliItem(null); setHavuzaEklendi({}); setDuzenlenenTur(null); setAiHata(""); setEkPaylasildi(false); if (yeniAcik !== null) { kayitliIcerikCek(dItem.ders); } else { setAiIcerik({}); } }} style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                        <span style={{ color: yazi, fontSize: "13px" }}>{ikon} {dItem.ders} <span style={{ color: ikincil, fontSize: "11px" }}>({dItem.saat} saat)</span></span>
                        <span style={{ color: acik ? "#818cf8" : ikincil, fontSize: "13px" }}>{acik ? "▾" : "▸"}</span>
                      </div>
                      {acik && (
                        <div style={{ padding: "0 14px 12px" }}>
                          {plan ? (
                            <>
                              <div style={{ background: "#15151f", borderRadius: "8px", padding: "10px 12px", marginBottom: "10px" }}>
                                <div style={{ color: "#06b6d4", fontSize: "12px", marginBottom: "4px" }}>📚 Konu: <span style={{ color: yazi }}>{plan.konu}</span></div>
                                <div style={{ color: ikincil, fontSize: "11px", lineHeight: 1.5 }}>🎯 Kazanim: <span style={{ color: "#c8bfb0" }}>{plan.kazanimlar.map(k => k.kod + " — " + k.aciklama).join(" · ")}</span></div>
                              </div>
                              <div style={{ display: "flex", gap: "8px", marginBottom: (icerikAcik || havuzAcik) ? "10px" : "0" }}>
                                <button onClick={() => { setHavuzAcik(true); setHavuzSeciliTur("anlatim"); setHavuzSeciliItem(null); havuzdanCek(plan); }} style={{ flex: 1, padding: "10px", background: "#b45309", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>📚 Havuzdan Indir</button>
                                <button onClick={() => { setIcerikAcik(!icerikAcik); setHavuzAcik(false); }} style={{ flex: 1, padding: "10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>🤖 AI ile Olustur</button>
                              </div>
                              {aiHata && <div style={{ color: "#f87171", fontSize: "11px", padding: "8px", background: "#2a1515", borderRadius: "8px", marginBottom: "8px" }}>{aiHata}</div>}
                              {icerikAcik && (
                                <div style={{ background: "#15151f", borderRadius: "8px", padding: "12px", border: "1px solid #4c1d95" }}>
                                  <div style={{ color: "#a78bfa", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" }}>🤖 AI Icerik Olustur — istedigine tikla</div>
                                  {["anlatim","sorular","odev","ekSorular"].map(tur => {
                                    const bilgi = TUR_BILGI[tur];
                                    const ikon = tur==="anlatim"?"📘":tur==="sorular"?"❓":tur==="odev"?"📝":"✏️";
                                    const varMi = !!aiIcerik[tur];
                                    const buYukleniyor = aiYukleniyorTur === tur;
                                    return (
                                      <div key={tur} style={{ marginBottom: "10px", borderBottom: "1px solid #1f1f2e", paddingBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                          <span onClick={() => { if(varMi) setAcikTur(acikTur===tur?null:tur); }} style={{ color: tur==="ekSorular"?"#fbbf24":"#06b6d4", fontSize: "12px", fontWeight: "600", cursor: varMi?"pointer":"default", flex: 1 }}>{ikon} {bilgi.ad} {varMi && <span style={{ color: "#666", fontSize: "11px" }}>{acikTur===tur?"▾":"▸"}</span>}</span>
                                          <div style={{ display: "flex", gap: "5px" }}>
                                            {varMi && tur!=="ekSorular" && <button onClick={() => wordIndir(bilgi.ad, aiIcerik[tur], dItem.ders, plan.konu)} style={{ padding: "4px 9px", background: "#0f6e56", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>⬇️ Indir</button>}
                                            {varMi && <button onClick={() => duzenleBaslat(tur)} style={{ padding: "4px 9px", background: "#1e40af", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>✏️ Duzenle</button>}
                                            {varMi && <button onClick={() => havuzaEkle(dItem.ders, plan, tur)} disabled={havuzaEklendi[tur]} style={{ padding: "4px 9px", background: havuzaEklendi[tur]?"#10b981":"#b45309", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: havuzaEklendi[tur]?"default":"pointer" }}>{havuzaEklendi[tur]?"✓ Havuzda":"📚 Havuza Ekle"}</button>}
                                            <button onClick={() => aiUretTur(dItem.ders, plan, tur)} disabled={buYukleniyor}
                                              style={{ padding: "4px 9px", background: buYukleniyor?"#3730a3":(varMi?"#374151":"#7c3aed"), color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: buYukleniyor?"wait":"pointer" }}>
                                              {buYukleniyor ? "..." : (varMi ? "🔄 Yeniden" : "✨ Olustur")}
                                            </button>
                                          </div>
                                        </div>
                                        {varMi && acikTur===tur && <div style={{ color: "#c8bfb0", fontSize: "12px", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: "400px", overflowY: "auto", background: "#0f0f1a", padding: "12px", borderRadius: "6px" }}>{aiIcerik[tur]}</div>}
                                        {varMi && acikTur===tur && tur==="ekSorular" && (
                                          <>
                                          <textarea value={ogretmenNotu} onChange={e => setOgretmenNotu(e.target.value)}
                                            placeholder="Buraya not ekleyebilirsin... orn: Yapamadiginiz sorulari not alin, yarin beraber yapalim."
                                            rows={2}
                                            style={{ width: "100%", marginTop: "6px", padding: "8px 10px", background: "#0f0f1a", color: yazi, border: "1px solid #333", borderRadius: "8px", fontSize: "12px", boxSizing: "border-box", fontFamily: "Georgia, serif", resize: "vertical" }} />
                                          <button onClick={() => ekSorulariPaylas(dItem.ders)} disabled={ekPaylasildi}
                                            style={{ width: "100%", marginTop: "6px", padding: "9px", background: ekPaylasildi?"#10b981":"#f59e0b", color: ekPaylasildi?"#fff":"#1a1a2e", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: ekPaylasildi?"default":"pointer" }}>
                                            {ekPaylasildi ? "✓ Paylasildi" : "📱 Uygulamada Paylas (cocuk gorur)"}
                                          </button>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ color: ikincil, fontSize: "12px", padding: "6px 0" }}>
                              Bu ders icin yillik plan eslesmesi bulunamadi. Ders adini "Matematik, Turkce, Fen Bilimleri, Sosyal Bilgiler, Ingilizce" gibi yazarsan kazanim otomatik gelir.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!seciliGun && <div style={{ textAlign: "center", color: ikincil, fontSize: "12px", padding: "10px" }}>Bir gune tikla, o gunun derslerini ve kazanimlarini gor.</div>}

      {duzenlenenTur && createPortal(
        <div onClick={() => { if (window.confirm("Kaydetmeden cikilsin mi? Degisiklikler kaybolur.")) setDuzenlenenTur(null); }} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px", boxSizing: "border-box" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#e8e8ec", borderRadius: "12px", width: "100%", maxWidth: "820px", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ background: "#1a1a2e", color: "#fff", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>✏️ {TUR_BILGI[duzenlenenTur].ad} — Duzenle</span>
              <button onClick={() => { if (window.confirm("Kaydetmeden cikilsin mi? Degisiklikler kaybolur.")) setDuzenlenenTur(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px", fontWeight: "700" }}>✕</button>
            </div>
            {(() => {
              // Tek akis duzenleme. lineHeight 12pt * 1.5 = 18pt = 24px. 50 satir = 1200px'de bir cizgi.
              const satirYuksekligi = 24; // px (12pt fontta 1.5 lineHeight)
              const sayfaYuksekligi = satirYuksekligi * 50; // 50 satir = 1 sayfa
              const toplamSatir = (duzenMetin || "").split("\n").reduce((t, s) => t + Math.max(1, Math.ceil(s.length / 95)), 0);
              const sayfaSayisi = Math.max(1, Math.ceil(toplamSatir / 50));
              return (
                <>
                  <div style={{ background: "#374151", textAlign: "center", padding: "6px", color: "#fff", fontSize: "12px" }}>
                    📄 Yaklasik {sayfaSayisi} sayfa · Cizgiler sayfa sonunu gosterir
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", background: "#9ca3af" }}>
                    <textarea
                      value={duzenMetin}
                      onChange={(e) => setDuzenMetin(e.target.value)}
                      autoFocus
                      spellCheck={false}
                      style={{
                        display: "block", width: "100%", maxWidth: "21cm",
                        margin: "0 auto", padding: "2cm 1.8cm", minHeight: "27cm",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.3)", fontFamily: "Calibri, Arial, sans-serif",
                        color: "#1a1a2e", fontSize: "12pt", lineHeight: "24px", border: "none",
                        outline: "none", boxSizing: "border-box", resize: "none", overflow: "hidden",
                        background: "#fff",
                        backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent " + (sayfaYuksekligi - 2) + "px, #d1495b 0px, #d1495b " + sayfaYuksekligi + "px)",
                        backgroundPosition: "0 calc(2cm)",
                        backgroundAttachment: "local"
                      }}
                      onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.max(e.target.scrollHeight, 1020) + "px"; }}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight, 1020) + "px"; } }}
                    />
                  </div>
                </>
              );
            })()}
            <div style={{ background: "#1a1a2e", padding: "12px 18px", display: "flex", gap: "10px" }}>
              <button onClick={() => duzenleKaydet(duzenlenenTur)} style={{ flex: 1, padding: "12px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>💾 Kaydet ve Kapat</button>
              <button onClick={() => { if (window.confirm("Kaydetmeden cikilsin mi?")) setDuzenlenenTur(null); }} style={{ padding: "12px 24px", background: "#4b5563", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>Iptal</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {havuzAcik && createPortal(
        <div onClick={() => { setHavuzAcik(false); setHavuzSeciliItem(null); }} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "16px", boxSizing: "border-box" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#e8e8ec", borderRadius: "12px", width: "100%", maxWidth: "920px", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ background: "#1a1a2e", color: "#fff", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>📚 Icerik Havuzu — Ogretmenlerin Paylasimlari</span>
              <button onClick={() => { setHavuzAcik(false); setHavuzSeciliItem(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px", fontWeight: "700" }}>✕</button>
            </div>
            {/* Tur sekmeleri */}
            <div style={{ background: "#252538", display: "flex", gap: "2px", padding: "8px 8px 0", flexShrink: 0 }}>
              {["anlatim","sorular","odev","ekSorular"].map(tur => {
                const ikon = tur==="anlatim"?"📘":tur==="sorular"?"❓":tur==="odev"?"📝":"✏️";
                const adet = (havuzListe[tur] || []).length;
                const sec = havuzSeciliTur === tur;
                return (
                  <button key={tur} onClick={() => { setHavuzSeciliTur(tur); setHavuzSeciliItem(null); }}
                    style={{ flex: 1, padding: "8px 4px", background: sec?"#e8e8ec":"#1a1a2e", color: sec?"#1a1a2e":"#888", border: "none", borderRadius: "8px 8px 0 0", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                    {ikon} {tur==="anlatim"?"Konu Anlatimi":tur==="sorular"?"Sinif Sorulari":tur==="odev"?"Ev Odevi":"Uygulama"} ({adet})
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {havuzYukleniyor ? (
                <div style={{ color: "#666", fontSize: "13px", textAlign: "center", padding: "40px" }}>Havuz yukleniyor...</div>
              ) : (() => {
                const liste = havuzListe[havuzSeciliTur] || [];
                if (liste.length === 0) return <div style={{ color: "#888", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "40px" }}>Bu turde henuz paylasim yok.</div>;
                return (
                  <>
                    {/* Ogretmen isimleri seritti */}
                    <div style={{ background: "#d1d5db", padding: "10px", display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0, borderBottom: "1px solid #9ca3af" }}>
                      {liste.map(item => {
                        const benimki = item.ekleyenUid === ogretmenUid;
                        const sec = havuzSeciliItem && havuzSeciliItem.id === item.id;
                        return (
                          <button key={item.id} onClick={() => setHavuzSeciliItem(item)}
                            style={{ padding: "6px 12px", background: sec?"#1a1a2e":"#fff", color: sec?"#fff":"#1a1a2e", border: benimki?"2px solid #b45309":"1px solid #9ca3af", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontWeight: sec?"600":"400" }}>
                            👤 {item.ekleyenIsim || "Ogretmen"}{benimki && " (sen)"}
                          </button>
                        );
                      })}
                    </div>
                    {/* Onizleme alani */}
                    <div style={{ flex: 1, padding: "20px", background: "#9ca3af", overflowY: "auto" }}>
                      {!havuzSeciliItem ? (
                        <div style={{ color: "#374151", fontSize: "13px", textAlign: "center", padding: "40px" }}>👆 Yukaridan bir ogretmen sec, icerigini gor.</div>
                      ) : (
                        <>
                          <A4Onizleme metin={havuzSeciliItem.metin} />
                          <div style={{ maxWidth: "21cm", margin: "14px auto 0", display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                            {havuzSeciliTur!=="ekSorular" && <button onClick={() => wordIndir(TUR_BILGI[havuzSeciliTur].ad, havuzSeciliItem.metin, havuzSeciliItem.ders, havuzSeciliItem.konu)} style={{ padding: "10px 20px", background: "#0f6e56", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>⬇️ Word Indir</button>}
                            {havuzSeciliTur==="ekSorular" && <button onClick={() => havuzdanPaylas(havuzSeciliItem)} style={{ padding: "10px 20px", background: "#f59e0b", color: "#1a1a2e", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>📱 Uygulamada Paylas</button>}
                            {havuzSeciliItem.ekleyenUid === ogretmenUid && <button onClick={() => { havuzSil(havuzSeciliItem.id, havuzSeciliTur); setHavuzSeciliItem(null); }} style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>🗑️ Sil</button>}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Takvim;