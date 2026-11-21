# MyLang — Kode Lebih Mudah, Logika Lebih Dekat.

MyLang adalah bahasa pemrograman general-purpose dengan sintaks Bahasa Indonesia, dirancang oleh **EpannXD** untuk pemula hingga developer yang ingin menulis kode dengan struktur yang bersih dan mudah dibaca.

- **Ekstensi**: `.mylang`
- **Versi**: 1.0.0
- **Runtime**: Node.js 20+
- **CLI**: `my`
- **Lisensi**: MIT

## Instalasi

```bash
git clone https://github.com/EpannXD/mylang.git
cd mylang
npm install
npm link      # untuk perintah global `my`
```

Atau jalankan langsung:

```bash
node bin/my.js run examples/hello.mylang
```

## Program Pertama

```mylang
tampilkan("Halo Dunia!")

nama = "Epann"
umur = 17
tampilkan("Nama: " + nama)
tampilkan("Halo, {nama}! Umur kamu {umur} tahun.")
```

## Sintaks Dasar

### Variabel

```mylang
nama = "Epann"
umur = 17
aktif = benar
saldo = 150000
tetap PI = 3.14     // konstanta
```

### Tipe Data

- `teks` (string): `"halo"`
- `angka` (number): `42`, `3.14`
- `benar` / `salah` (boolean)
- `kosong` (null)
- `daftar` (array): `["a", "b"]`
- `objek` (object): `{ nama: "Epann" }`

### Percabangan

```mylang
jika umur >= 18 {
    tampilkan("Dewasa")
} selain jika umur >= 13 {
    tampilkan("Remaja")
} selain {
    tampilkan("Anak")
}
```

### Perulangan

```mylang
untuk i dari 1 sampai 10 {
    tampilkan(i)
}

selama benar {
    tampilkan("Berjalan")
    berhenti
}
```

### Fungsi

```mylang
fungsi tambah(a, b) {
    kembalikan a + b
}

fungsi sapa(nama = "Dunia") {
    tampilkan("Halo " + nama)
}

tampilkan(tambah(10, 20))
sapa()
```

### Array & Objek

```mylang
buah = ["Apel", "Jeruk"]
buah.tambah("Mangga")
buah.hapus("Jeruk")
tampilkan(buah[0])

pengguna = { nama: "Epann", umur: 17 }
tampilkan(pengguna.nama)
pengguna.umur = 18
```

### Class

```mylang
kelas Pengguna {
    fungsi buat(nama) {
        diri.nama = nama
    }
    fungsi sapa() {
        tampilkan("Halo " + diri.nama)
    }
}

user = Pengguna("Epann")
user.sapa()
```

### Error Handling

```mylang
coba {
    lemparkan "Terjadi kesalahan"
} tangkap error {
    tampilkan("Error: " + error.message)
} akhirnya {
    tampilkan("Selesai")
}
```

### Modul

```mylang
// matematika.mylang
fungsi tambah(a, b) { kembalikan a + b }
ekspor tambah

// main.mylang
ambil { tambah } dari "./matematika.mylang"
tampilkan(tambah(1, 2))
```

### Async / Await

```mylang
asinkron fungsi ambilData() {
    hasil = tunggu http.get("https://api.example.com")
    kembalikan hasil.teks
}

data = tunggu ambilData()
tampilkan(data)
```

## Standard Library

| Modul | Fungsi |
|-------|--------|
| `teks` | `panjang`, `besar`, `kecil`, `ganti`, `potong`, `pisah`, `mengandung` |
| `angka` | `bulat`, `acak`, `maks`, `min`, `mutlak`, `parse` |
| `daftar` | `panjang`, `urutkan`, `balik`, `gabung`, `salin` |
| `waktu` | `sekarang`, `tidur`, `format` |
| `berkas` | `baca`, `tulis`, `hapus`, `ada`, `daftar` |
| `sistem` | `platform`, `cwd`, `env`, `argumen`, `keluar` |
| `json` | `parse`, `stringify` |
| `http` | `get`, `post`, `put`, `hapus` |
| `matematika` | `pi`, `e`, `sin`, `cos`, `sqrt`, `pow`, `log` |

## CLI

```bash
my --version
my --help
my init [nama]               # buat project baru
my run main.mylang           # jalankan program
my check main.mylang         # cek sintaks
my repl                      # interactive shell
my fmt file.mylang           # format kode
my watch file.mylang         # auto-run saat berubah
my test                      # jalankan tests
my build main.mylang         # build artifact
my install paket             # tambah dependency
my list                      # lihat dependency
```

## Struktur Project

```
mylang/
├── bin/my.js
├── src/
│   ├── compiler/     # lexer, parser
│   ├── interpreter/  # environment, evaluator
│   ├── runtime/      # (built into interpreter)
│   ├── stdlib/       # modul standard
│   └── cli/          # command line
├── examples/         # contoh program
├── tests/            # automated tests
└── README.md
```

## Testing

```bash
npm test
```

## Filosofi

1. **Sederhana itu kuat** — sintaks yang mudah dibaca tidak berarti kurang mampu.
2. **Bahasa Indonesia, logika universal** — belajar konsep programming tanpa terhambat bahasa.
3. **Eksplisit lebih baik dari implisit** — error jelas, pesan membantu.

## Kontribusi

Pull request dan issue sangat welcome! Silakan fork dan kirim PR.

## Lisensi

MIT © EpannXD
