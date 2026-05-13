import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">

        <div className="zupii-logo">
          <h1>🎈 ZUPii</h1>
          <p className="slogan">Zevkli Üçüşan Paylaşımlı İnteraktif İçerikler</p>
        </div>

        <div className="giris-kutusu">
          <h2>Hoş Geldin! 👋</h2>

          <div className="giris-secenekleri">
            <button className="btn-eokul">
              🏫 e-Okul ile Giriş Yap
            </button>
            <button className="btn-veli">
              👨‍👩‍👧 Veli Girişi
            </button>
            <button className="btn-ogretmen">
              📚 Öğretmen Girişi
            </button>
          </div>

          <div className="bilgi-kutusu">
            <p>✅ Tamamen yerli ve güvenli</p>
            <p>✅ Veli onay sistemi</p>
            <p>✅ MEB denetimli içerikler</p>
          </div>
        </div>

      </header>
    </div>
  );
}

export default App;