import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { YILLIK_PLAN, DERS_BILGI } from "./yillikPlan";
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
  const [dersProgrami, setDersProgrami] = useState({}); // {0:[{ders,saat}],1:[...]} 0=Pzt
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
  const [acikTur, setAcikTur] = useState(null); // hangi AI turu icerik acik

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "ogretmenTakvim", ogretmenUid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setDersProgrami(d.dersProgrami || {});
          setNotlar(d.notlar || {});
        }
      } catch (e) { console.error(e); }
      setYukleniyor(false);
      // Acilista bugunu sec (otomatik)
      setSeciliGun(new Date());
    })();
  }, [ogretmenUid]);

  const takvimKaydet = async (yeniProgram, yeniNotlar) => {
    try {
      const ref = doc(db, "ogretmenTakvim", ogretmenUid);
      await setDoc(ref, {
        dersProgrami: yeniProgram !== undefined ? yeniProgram : dersProgrami,
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
    const kaynak = tabloTaslak || dersProgrami;
    const liste = kaynak[gun] || [];
    return liste[saat] ? liste[saat].ders : "";
  };
  const tabloDegistir = (gun, saat, deger) => {
    const taslak = tabloTaslak || JSON.parse(JSON.stringify(dersProgrami));
    if (!taslak[gun]) taslak[gun] = [];
    while (taslak[gun].length <= saat) taslak[gun].push({ ders: "", saat: "1" });
    taslak[gun][saat] = { ders: deger, saat: "1" };
    setTabloTaslak({ ...taslak });
  };
  const tabloyuKaydet = () => {
    const kaynak = tabloTaslak || dersProgrami;
    // Bos dersleri temizle (sondan), her gun icin ardisik dolu dersleri tut
    const temiz = {};
    for (let g = 0; g < 5; g++) {
      const liste = (kaynak[g] || []).filter(d => d.ders && d.ders.trim());
      if (liste.length) temiz[g] = liste;
    }
    setDersProgrami(temiz);
    setTabloTaslak(null);
    takvimKaydet(temiz);
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
      secilenDersler = dersProgrami[secilenGunIdx] || [];
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
    const plan = YILLIK_PLAN[secilenHaftaBilgi.haftaNo];
    return plan ? plan[key] : null;
  };

  // ===== AI icerik anahtari (tarih + ders + tur) =====
  const icerikAnahtar = (dersAd, tur) => {
    if (!seciliGun) return null;
    return ogretmenUid + "_" + gunKey(seciliGun) + "_" + dersAd.replace(/\s/g, "") + "_" + tur;
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
    anlatim: { ad: "Konu Anlatimi (Ogretmen Kilavuzu)", talimat: "Ogretmenin sinifta bu konuyu ADIM ADIM nasil anlatacagina dair detayli bir KILAVUZ hazirla. Su yapida olsun: (1) Derse giris/dikkat cekme onerisi, (2) Konuyu acmak icin gunluk hayattan SOMUT ornekler (orn: tartma konusunda 'kalemi mektup terazisiyle, bir cuval unu kantarla, kendimizi banyo terazisiyle tartariz' gibi karsilastirmali ornekler), (3) Ogretmenin sinifta sorabilecegi sorular ('Cocuklar sizce fil mi agir kus mu?'), (4) Yapilabilecek basit etkinlik/gosterim onerisi, (5) Dikkat edilmesi gereken kavram yanilgilari. Dolu, ogretmene gercekten yol gosteren bir metin olsun. En az 4-5 paragraf." },
    sorular: { ad: "Sinif Sorulari", talimat: "Konuyla ilgili 10 adet sinif ici soru hazirla. Kolaydan zora siralanmis, numarali. Cesitli olsun (bosluk doldurma, problem, kisa cevap). Sonunda CEVAP ANAHTARI bolumu ekle. Toplamda 2 sayfalik dolu bir calisma kagidi olacak kadar icerik uret." },
    odev: { ad: "Ev Odevi", talimat: "Ev odevi olarak 10 adet alistirma hazirla. Kolaydan zora, numarali, cocugun evde tek basina yapabilecegi seviyede. Cesitli soru tipleri kullan. Sonunda kisa CEVAP ANAHTARI. Toplamda 2 sayfalik dolu bir odev olacak kadar icerik uret." },
    ekSorular: { ad: "Uygulama Sorulari", talimat: "Cocuklarin telefonda/ekrandan gorecegi 10 adet kisa, net soru/problem hazirla. SADECE sorular, numarali (1. 2. 3. ...), alt alta, cok sade dil. O gun sinifta verilenlerden FARKLI, ayni konuda taze sorular. Cevap anahtari EKLEME (cocuk gorecek)." }
  };

  const aiUretTur = async (dersAd, plan, tur) => {
    setAiYukleniyorTur(tur); setAiHata("");
    const kazanimMetni = plan.kazanimlar.map(k => k.aciklama).join("; ");
    const tb = TUR_BILGI[tur];
    const prompt = `Sen deneyimli bir ilkokul 4. sinif ogretmenisin. Asagidaki ders icin Turkce, sade, cocuk seviyesine uygun icerik hazirla.

Ders: ${dersAd}
Konu: ${plan.konu}
Kazanimlar: ${kazanimMetni}

GOREV: ${tb.talimat}

Sadece istenen icerigi yaz, baska aciklama ekleme. Turkce karakterleri normal kullan (c, s, g, i, o, u yerine gercek ç, ş, ğ, ı, ö, ü).`;

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
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      if (data.error) { setAiHata(data.error.message || "AI hatasi"); setAiYukleniyorTur(null); return; }
      const metin = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : "";
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
  const pdfIndir = (baslik, icerik) => {
    const pencere = window.open("", "_blank");
    if (!pencere) { alert("Pop-up engellendi. Lutfen izin ver."); return; }
    pencere.document.write(`<html><head><title>${baslik}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;line-height:1.7;color:#222;}
      h1{font-size:18px;border-bottom:2px solid #4f46e5;padding-bottom:8px;}
      pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;}</style></head>
      <body><h1>${baslik}</h1><pre>${icerik.replace(/</g,"&lt;")}</pre>
      <scr"+"ipt>window.onload=function(){window.print();}</scr"+"ipt></body></html>`);
    pencere.document.close();
  };

  // ===== Ek sorulari paylas (cocuk ekrandan gorur) =====
  const ekSorulariPaylas = async (dersAd) => {
    if (!aiIcerik.ekSorular) return;
    try {
      const konuMetni = (dersPlanBilgisi(dersAd)?.konu) || "";
      await addDoc(collection(db, "duyurular"), {
        icerik: "📱 " + dersAd + " - Uygulama Sorulari\n" + (konuMetni ? "(" + konuMetni + ")\n" : "") + "\n" + aiIcerik.ekSorular,
        tip: "uygulamaSorusu",
        dersAd: dersAd,
        sorular: aiIcerik.ekSorular,
        konu: konuMetni,
        yazar: ogretmenIsmi, yazarUid: ogretmenUid,
        tarih: serverTimestamp(), begenenler: [], fotoUrl: null, adminSildi: false
      });
      setEkPaylasildi(true);
    } catch (e) { alert("Paylasilamadi: " + e.message); }
  };

  const kart = "#1a1a2e", kart2 = "#252538", yazi = "#f0e6d3", ikincil = "#888";

  if (yukleniyor) return <p style={{ color: ikincil, textAlign: "center", padding: "20px", fontFamily: "Georgia, serif" }}>Takvim yukleniyor...</p>;

  return (
    <div style={{ fontFamily: "Georgia, serif", width: "100%", maxWidth: "760px", margin: "0 auto" }}>

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
                      <div onClick={() => { const yeniAcik = acik ? null : di; setAcikDers(yeniAcik); setIcerikAcik(false); setAiHata(""); setEkPaylasildi(false); if (yeniAcik !== null) { kayitliIcerikCek(dItem.ders); } else { setAiIcerik({}); } }} style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
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
                              <div style={{ display: "flex", gap: "8px", marginBottom: icerikAcik ? "10px" : "0" }}>
                                <button onClick={() => { setIcerikAcik(!icerikAcik); }} style={{ flex: 1, padding: "10px", background: "#0f6e56", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>📖 Kazanimi Paylas</button>
                                <button onClick={() => { setIcerikAcik(!icerikAcik); }} style={{ flex: 1, padding: "10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>🤖 AI ile Olustur</button>
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
                                            {varMi && tur!=="ekSorular" && <button onClick={() => pdfIndir(dItem.ders + " - " + bilgi.ad, aiIcerik[tur])} style={{ padding: "4px 9px", background: "#0f6e56", color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>⬇️ PDF</button>}
                                            <button onClick={() => aiUretTur(dItem.ders, plan, tur)} disabled={buYukleniyor}
                                              style={{ padding: "4px 9px", background: buYukleniyor?"#3730a3":(varMi?"#374151":"#7c3aed"), color: "#fff", border: "none", borderRadius: "6px", fontSize: "10px", cursor: buYukleniyor?"wait":"pointer" }}>
                                              {buYukleniyor ? "..." : (varMi ? "🔄 Yeniden" : "✨ Olustur")}
                                            </button>
                                          </div>
                                        </div>
                                        {varMi && acikTur===tur && <div style={{ color: "#c8bfb0", fontSize: "12px", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: "400px", overflowY: "auto", background: "#0f0f1a", padding: "12px", borderRadius: "6px" }}>{aiIcerik[tur]}</div>}
                                        {varMi && acikTur===tur && tur==="ekSorular" && (
                                          <button onClick={() => ekSorulariPaylas(dItem.ders)} disabled={ekPaylasildi}
                                            style={{ width: "100%", marginTop: "6px", padding: "9px", background: ekPaylasildi?"#10b981":"#f59e0b", color: ekPaylasildi?"#fff":"#1a1a2e", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: ekPaylasildi?"default":"pointer" }}>
                                            {ekPaylasildi ? "✓ Paylasildi" : "📱 Uygulamada Paylas (cocuk gorur)"}
                                          </button>
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
    </div>
  );
}

export default Takvim;