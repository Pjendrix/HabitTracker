# Deník — Habit & Budget Tracker

Webová appka, která nahrazuje denní práci s HABIT_TRACKER_2026.xlsx: zápis výdajů,
návyky, měsíční rozpočet a portfolio. React + Vite, data ve Firestore, hosting na Firebase.
Funguje samostatně; Excel je volitelný vstup i výstup.

## Rozjetí

Klíče z Firebase console (Project settings → Your apps → SDK setup → Config) vlož přímo
do `src/firebase.js`. Nejsou tajné — přístup k datům hlídají Firestore pravidla, ne utajení
klíče — takže můžou být v repu a hosting (Vercel, Firebase Hosting) nepotřebuje žádné
proměnné prostředí.

```bash
npm install
npm run dev
```

Ve Firebase console zapni **Authentication → Sign-in method → Email/Password**
a **Firestore Database** (produkční režim). Pak:

```bash
firebase login
firebase use --add          # vyber projekt
firebase deploy --only firestore:rules
npm run deploy              # build + hosting
```

## Import historie z Excelu

V appce: **Nastavení → Import z Excelu** → vyber soubor. Zpracuje se v prohlížeči, ukáže
náhled (kolik listů, dní, jaký rozsah) a teprve po potvrzení zapíše pod tvůj účet.
Pouštět se dá opakovaně — stejné dny přepíše, zbytek nechá být.

Ověřeno na tvém sešitu: 87 měsíčních listů, 2 194 dní, 2019-07 až 2026-09. Parser sám pozná,
že do konce 2024 byly částky v CZK a od 2025 v EUR (podle hlavičky G3), že se sport přesunul
ze sloupce P do N, a výplatu si dotáhne z listů `20XX summary`, kde jediná je.

Totéž jde i z příkazové řádky, když chceš data jen zkontrolovat:

```bash
node scripts/import-xlsx.mjs ../HABIT_TRACKER_2026.xlsx   # vyrobí seed.json, nic nezapíše
```

## Export zpátky do Excelu

V záložce **Měsíc → Stáhnout .xlsx** vypadne list se stejným rozvržením jako tvoje měsíční
záložky (B datum, C den, G–L kategorie, N sport, P–R návyky, T váha, W poznámka, řádek CELKEM
se `SUM()` vzorci). Vložíš ho do sešitu jako novou záložku a roční souhrn si na něj ukáže.

Přímý zápis do živého .xlsx z prohlížeče nejde — soubor je v OneDrive/na disku, ne v API.
Kdybys to chtěl plně automatické, jde to přes Microsoft Graph (OneDrive) nebo Google Sheets;
to je ale samostatná integrace, ne pár řádků.

## Datový model (Firestore)

```
users/{uid}/meta/settings        kategorie, návyky, fixní náklady, předplatné, rozpočet, pozice
users/{uid}/days/{YYYY-MM-DD}    { tx: [{id, amount, cur, cat, note}], habits: {…}, weight }
users/{uid}/months/{YYYY-MM}     { fx, income: {salary, extraEur, extraCzk}, fixedOverrides }
users/{uid}/portfolio/{YYYY-MM}  { fx, values: {positionId: number}, updatedAt }
```

Klíčový rozdíl proti sešitu: **atomem je jednotlivá transakce, ne denní součet za kategorii.**
Denní, měsíční i roční čísla se z ní dopočítávají, takže se nemůžou rozejít, a poznámka
("Alza", "Milano – letenka") drží u částky, ke které patří, místo v náhodném sloupci vedle.

## Co appka řeší jinak než sešit

- **Kurz na jednom místě.** Uložený u měsíce, ne přepisovaný v každém listu. Nový měsíc si
  vezme výchozí hodnotu z nastavení.
- **Kategorie mají ID.** Přejmenování „Zábava" na „Social" nerozbije meziroční srovnání.
- **Žádné šablony 30/31.** Počet dní se dopočítá z data.
- **Portfolio pozná prázdný měsíc.** Nevyplněné měsíce se nekopírují dopředu, takže graf
  neukazuje plochou čáru tam, kde jen chybí zápis. Předvyplnění z minulého měsíce je tlačítko,
  ne výchozí stav.
- **Tempo utrácení.** Appka počítá, kolik můžeš utratit denně do konce měsíce, aby ses vešel
  do plánu — a upozorní, když jsi napřed.
- **Offline zápis.** Firestore drží lokální cache, zápis bez signálu se propíše později.

## Struktura

```
src/
  App.jsx              přihlášení, navigace, sdílený stav měsíce
  firebase.js          inicializace SDK (+ offline cache)
  lib/model.js         datový model, měny, výpočty (streak, tempo rozpočtu)
  lib/store.js         Firestore hooky (settings, days, month, portfolio)
  lib/importXlsx.js    parser sešitu (sdílí ho appka i skript)
  lib/exportXlsx.js    export měsíce do rozvržení Excelu
  views/Today.jsx      rychlý zápis, denní přehled, návyky, váha
  views/Month.jsx      kalendář, kategorie vs. plán, návyky, export
  views/Budget.jsx     fixní náklady, předplatné, plán vs. skutečnost
  views/Portfolio.jsx  měsíční snapshoty, alokace, vývoj čistého jmění
  views/Settings.jsx   kategorie, návyky, fixní náklady, pozice, kurz
scripts/import-xlsx.mjs
```

## Co zatím chybí (v2)

Wishlist z listu *Planned Purchase* (včetně „dní čekání" a `% nákupu`) a DCA projekce
z *Investment Plan_TR*. Datový model s nimi počítá — přibudou jako `users/{uid}/wishlist/{id}`
a výpočet nad portfoliem, bez zásahu do zbytku.
