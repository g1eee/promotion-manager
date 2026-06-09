# Requirements Document

## Introduction

Promotion Management System (PMS) adalah aplikasi web SaaS internal untuk tim marketplace yang berfungsi sebagai pusat perencanaan, pengelolaan, dan pengarsipan promo marketplace. Sistem ini membantu SPV Marketing merencanakan promo, mengelola campaign dan promo secara terstruktur, memudahkan koordinasi antara SPV Marketing dan Admin Marketplace, serta menjadi single source of truth untuk seluruh promo marketplace beserta riwayatnya.

Sistem ini dirancang untuk operasi multi-brand sejak awal. Setiap Product, Campaign, dan Promo wajib dimiliki oleh tepat satu Brand (contoh brand: Kalova, Chanira, AMK, ATRIA). Struktur kepemilikan data mengikuti hierarki Brand → (Products, Campaigns, Promos, Cost Configuration). Tujuannya mendukung pengelolaan banyak brand dan mencegah migrasi basis data di masa depan.

> **Catatan keputusan arsitektur (Final Architecture Review):** Cost Configuration dimiliki **per Brand**, bukan global. Setiap Brand memiliki set komponen biayanya sendiri sehingga simulasi promo memakai Cost Configuration milik Brand promo tersebut (contoh: Admin Fee Kalova 8%, Admin Fee AMK 10%). Keputusan ini **secara sengaja menyimpang** dari PRD awal yang menetapkan "global cost configuration"; penyimpangan ini diambil agar tiap brand dapat mencerminkan struktur biaya marketplace yang berbeda. Selain itu, keunikan Product ID berlaku **per Brand** (bukan global): Product ID yang sama boleh ada di Brand berbeda namun harus unik dalam satu Brand.

Struktur navigasi (sidebar) sistem adalah sebagai berikut:

- Dashboard
- Brand Management
- Promo Management: Campaigns, Promo Scenarios, Promo Execution
- Master Data: Product Master, Cost Configuration, Promo Templates
- Reports: Campaign History, Promo History, Approval History

Dokumen ini membatasi ruang lingkup pada MVP sesuai PRD beserta penambahan modul Brand Management. Item roadmap V2 — Product Classification, Workflow Tracking, Scenario Comparison, dan AI Recommendation — berada di luar ruang lingkup (future scope) dan tidak dispesifikasikan di sini.

Sistem memiliki dua peran: **SPV Marketing** (membuat campaign, membuat promo, mendefinisikan skema promo, memilih produk, menjalankan simulasi, menyetujui promo) dan **Admin Marketplace** (melihat promo yang sudah disetujui, menggunakan data promo sebagai panduan setup marketplace, memberi feedback bila ada kendala implementasi).

### Prioritas Implementasi

Setiap requirement diberi penanda prioritas untuk membedakan item wajib MVP dari item opsional:

- **MANDATORY (MVP)**: Brand Management; relasi Brand→Product; relasi Brand→Campaign; relasi Brand→Promo; Promo Type; Feedback History; Promo Clone (duplikasi Promo_Scenario); kapabilitas pencarian promo historis lintas campaign (kini menjadi bagian dari Promo History).
- **NICE TO HAVE (Opsional)**: Margin Health (Profitability Indicator); Attachments; penyederhanaan menu Promo Execution.

Penanda prioritas dicantumkan pada judul atau awal setiap requirement yang relevan. Requirement tanpa penanda khusus merupakan bagian dari MVP inti yang sudah disepakati sebelumnya.

Selain penanda MANDATORY/NICE TO HAVE di atas, urutan delivery diatur dalam Sprint 0 dan tiga fase MVP berikut. Fasing ini hanya menata urutan implementasi dan TIDAK menurunkan requirement MANDATORY menjadi opsional:

- **Sprint 0 (Fondasi UI & Aplikasi)**: project setup, design system, app shell (layout, sidebar, top navigation), Global Brand Selector, authentication flow, dan session management. Sprint 0 ditetapkan sebelum pengembangan fitur.
- **MVP v1 (Core Operational Workflow)**: Authentication & RBAC, Brand Context, Product Master (termasuk peningkatan Import: Download Template, Import Validation Feedback, Import Summary), Cost Configuration, Campaign Management, Promo Scenario, Dynamic Rule Builder, Product Selection, **Promo Clone** (aksi frekuensi tinggi, dipindahkan ke v1), Promo Simulator, Approval Workflow, Promo Execution, dan Dashboard.
- **MVP v1.1 (Productivity & Historical Features)**: Promo History (termasuk pencarian lintas campaign).
- **MVP v1.2 (Secondary Management Features)**: Feedback Thread, Approval History (halaman/listing; logika penulisan Approval History oleh Approval Workflow tetap di MVP v1), Promo Templates, Attachments, dan Additional/Advanced Reporting (mis. Campaign History sebagai reporting sekunder). Catatan: penulisan Approval_History dalam transaksi (rollback) merupakan bagian Approval Workflow MVP v1, sedangkan yang berada di v1.2 hanya halaman/listing Approval History.

Property-Based Testing menyeluruh bersifat non-blocking untuk rilis MVP, sehingga unit, integration, dan business validation tests sudah cukup untuk MVP, dan metrik sukses MVP adalah SPV_Marketing dan Admin_Marketplace dapat menyelesaikan workflow promo harian tanpa spreadsheet. Fasing ini hanya menata urutan implementasi dan TIDAK menurunkan requirement MANDATORY menjadi opsional.

## Glossary

- **PMS (System)**: Promotion Management System, aplikasi web yang dispesifikasikan dalam dokumen ini.
- **SPV_Marketing**: Peran pengguna yang merencanakan dan menyetujui promo. Memiliki akses penuh ke modul Promo Management dan Master Data.
- **Admin_Marketplace**: Peran pengguna yang melaksanakan promo di marketplace. Hanya dapat melihat promo berstatus Approved dan memberi feedback.
- **Brand**: Entitas merek yang memayungi data operasional (contoh: Kalova, Chanira, AMK, ATRIA). Memiliki field Brand ID, Brand Name, Display Name, Status, serta field audit Created By, Created At, dan Updated At. Setiap Product, Campaign, Promo_Scenario, dan Cost_Configuration dimiliki oleh tepat satu Brand.
- **Dashboard**: Halaman ringkasan aktivitas sistem.
- **Product_Master**: Basis data produk yang dipakai dalam promo (Product ID, Nama Produk, Kategori, HPP, Harga Jual, Status, Brand, serta field audit Created By, Created At, dan Updated At). Keunikan produk ditegakkan semata-mata pada kombinasi (Brand + Product ID); kombinasi tersebut harus unik, sehingga Product ID yang sama boleh digunakan pada Brand berbeda namun harus unik dalam satu Brand. Nama Produk **tidak** memiliki batasan keunikan: Nama Produk yang sama boleh muncul pada Brand berbeda maupun dalam Brand yang sama, karena identitas produk ditentukan oleh Product ID dalam Brand-nya, bukan oleh Nama Produk. Nama Produk tidak pernah digunakan sebagai kunci relasi/foreign key.
- **Product_Status (Status Produk)**: Status siklus hidup produk pada Product_Master dengan nilai: **Active** (dapat dipilih pada promo baru), **Inactive** (tidak dapat dipilih pada promo baru namun tetap terlihat pada catatan historis), dan **Archived** (disembunyikan dari pemilihan produk normal namun tetap dipertahankan untuk keperluan pelaporan/historis).
- **HPP**: Harga Pokok Produksi sebuah produk (dalam Rupiah).
- **Harga_Jual**: Harga jual normal produk (dalam Rupiah).
- **Cost_Configuration**: Kumpulan komponen biaya (dalam persen) yang dimiliki **per Brand** dan dipakai pada simulasi promo Brand tersebut. Setiap Brand memiliki satu set Cost_Configuration sendiri (Admin Fee, Shipping Fee, Promo Xtra, Fee Pesanan, Campaign Fee, Promosi Fee, Marketing Fee, Ads Spending, Affiliate Commission, Operating Cost).
- **Promo_Template**: Pola promo siap pakai untuk mempercepat pembuatan promo.
- **Campaign**: Wadah (container) yang menampung satu atau lebih promo, dimiliki oleh sebuah Brand. Memiliki Status: Draft, Active, Completed, Archived, serta field audit Created By, Created At, dan Updated At. Relasi terhadap promo bersifat satu-ke-banyak: satu Campaign dapat menampung banyak Promo_Scenario.
- **Promo_Scenario (Promo)**: Definisi promo yang dibuat SPV, dimiliki oleh sebuah Brand dan menjadi bagian dari tepat satu Campaign, terdiri dari Basic Information, Rules, dan Products. Memiliki Status: Draft, Review, Approved, Rejected, Active, Completed, serta field audit Created By, Created At, dan Updated At. Brand sebuah Promo_Scenario harus konsisten dengan Brand Campaign-nya. Produk pada Promo_Scenario direferensikan melalui Product record dari Product_Master (teridentifikasi sebagai Product ID dalam Brand-nya) sebagai source of truth, bukan melalui Nama Produk.
- **Promo_Type**: Jenis promo yang dipilih pada Basic Information Promo_Scenario, dengan nilai: Buy X Discount, Buy X Get Gift, Voucher, Flash Sale, atau Bundle Promo.
- **Rule**: Aturan promo berbentuk kondisi minimum quantity yang memetakan ke sebuah benefit (diskon % atau free gift).
- **Dynamic_Rule_Builder**: Komponen untuk menambah Rule dalam jumlah tidak terbatas pada sebuah promo.
- **Promo_Simulator**: Fitur pendukung yang menghitung kelayakan promo per produk secara real-time.
- **Margin**: Selisih hasil setelah dikurangi HPP, dinyatakan dalam Rupiah dan persen.
- **NPM**: Net Profit Margin, laba bersih setelah seluruh komponen biaya, dinyatakan dalam Rupiah dan persen.
- **Margin_Health (Profitability Indicator)**: Indikator analitis pendukung keputusan (Profitability Indicator) berbasis hasil simulator dengan nilai Healthy, Warning, atau Risky. Bersifat analisis/pendukung keputusan semata: Margin_Health TIDAK membuat keputusan bisnis dan TIDAK memengaruhi proses approval.
- **Attachment**: Berkas pendukung yang diunggah pada Promo_Scenario (opsional), memiliki field Attachment Name, File URL, Uploaded By, dan Upload Date.
- **Approval_System**: Mekanisme perubahan status promo (Draft, Review, Approved, Rejected).
- **Approved_Promos**: Halaman yang menampilkan seluruh promo berstatus Approved.
- **Admin_Execution_Board**: Halaman bagi Admin_Marketplace untuk melihat promo Approved sebagai panduan setup.
- **Feedback_Record**: Catatan feedback terstruktur yang tersimpan sebagai riwayat dan berfungsi sebagai utas diskusi dua arah, memiliki field Feedback Message, Created By User (pengguna pembuat feedback), Created Date, dan Promo Reference. Feedback_Record dapat dibuat oleh setiap peran yang memiliki akses ke promo bersangkutan (SPV_Marketing maupun Admin_Marketplace). Satu Promo_Scenario dapat memiliki banyak Feedback_Record.
- **Execution_Status**: Status pelaksanaan promo: Approved, Sent to Admin, Marketplace Setup, Completed.
- **Promo_Execution**: Tampilan tunggal (opsional/nice-to-have) hasil penggabungan halaman Approved_Promos dan Execution Status, menampilkan promo Approved beserta status pelaksanaan Approved, Sent to Admin, Marketplace Setup, dan Completed.
- **Reports**: Modul laporan yang terdiri dari Campaign History, Promo History, dan Approval History. Kapabilitas pencarian promo historis lintas campaign (sebelumnya Promo Library) kini menjadi bagian dari Promo History.
- **Audit_Fields**: Sekumpulan field pelacakan yang melekat pada entitas utama (Brand, Campaign, Promo_Scenario, dan Product), terdiri dari Created By (pengguna pembuat), Created At (waktu pembuatan), dan Updated At (waktu modifikasi terakhir).
- **Promo_Clone**: Kapabilitas MVP (mandatory) yang menduplikasi sebuah Promo_Scenario yang sudah ada dengan menyalin Promo_Type, Rules, dan Product List. Promo hasil klona dimulai dengan Status Draft, memperoleh field audit baru (Created By/Created At = pengguna yang melakukan klona/waktu saat ini), dan mereferensikan produk melalui identitas Product (Brand + Product ID) yang konsisten dengan Brand promo hasil klona.

## Requirements

### Requirement 1: Otentikasi dan Kontrol Akses Berbasis Peran

**User Story:** As a pengguna sistem, I want akses dibatasi sesuai peran saya, so that setiap peran hanya dapat melakukan tindakan yang menjadi tanggung jawabnya.

#### Acceptance Criteria

1. THE PMS SHALL mengasosiasikan setiap akun pengguna dengan tepat satu peran yaitu SPV_Marketing atau Admin_Marketplace.
2. WHERE pengguna memiliki peran SPV_Marketing, THE PMS SHALL mengizinkan akses untuk membuat dan mengubah seluruh lima jenis sumber daya yaitu Campaign, Promo_Scenario, Product_Master, Cost_Configuration, dan Promo_Template sebagai satu kesatuan hak akses (seluruhnya atau tidak sama sekali).
3. WHERE pengguna memiliki peran Admin_Marketplace, THE PMS SHALL membatasi akses hanya untuk melihat Promo_Scenario berstatus Approved dan mengirim feedback implementasi.
4. WHERE pengguna memiliki peran SPV_Marketing, THE PMS SHALL mengizinkan SPV_Marketing melihat Promo_Scenario berstatus Approved dan membuat Feedback_Record pada promo tersebut.
5. THE PMS SHALL mengizinkan setiap pengguna yang memiliki akses ke sebuah Promo_Scenario (SPV_Marketing maupun Admin_Marketplace) untuk membuat Feedback_Record pada promo tersebut sebagai utas diskusi dua arah.
6. IF Admin_Marketplace mencoba mengakses fungsi pembuatan atau pengubahan Campaign, Promo_Scenario, Product_Master, Cost_Configuration, atau Promo_Template, THEN THE PMS SHALL menolak permintaan tersebut dan menampilkan pesan akses ditolak.

### Requirement 2: Dashboard

**User Story:** As a SPV_Marketing, I want melihat ringkasan aktivitas sistem di satu halaman, so that saya dapat memantau kondisi promo secara cepat.

#### Acceptance Criteria

1. WHEN Dashboard dimuat, THE PMS SHALL menampilkan widget Total Campaign, Total Promo, Promo Draft, Promo Review, Promo Approved, Promo Rejected, Promo Active, dan Promo Completed.
2. WHEN Dashboard dimuat, THE PMS SHALL menghitung setiap widget berdasarkan data Campaign dan Promo_Scenario terkini.
3. WHEN Dashboard dimuat, THE PMS SHALL menampilkan Recent Activity yang berisi campaign terbaru, promo terbaru, dan approval terbaru.
4. WHEN data Campaign atau Promo_Scenario berubah, THE PMS SHALL membentuk kewajiban pembaruan tertunda (pending) yang akan diterapkan pada pemuatan Dashboard berikutnya agar nilai widget konsisten dengan data terkini.
5. WHEN SPV_Marketing memilih sebuah Brand sebagai filter pada Dashboard, THE PMS SHALL menghitung seluruh widget dan Recent Activity hanya berdasarkan Campaign dan Promo_Scenario yang dimiliki oleh Brand tersebut.
6. WHEN Dashboard dimuat, THE PMS SHALL menampilkan indikator antrian kerja personal (work queue) yang terdiri dari Pending Reviews (jumlah Promo_Scenario berstatus Review), Rejected Promos (jumlah Promo_Scenario berstatus Rejected), Unread Feedback (jumlah Feedback_Record yang belum dibaca pengguna), dan Waiting for Execution (jumlah Promo_Scenario berstatus Approved yang Execution_Status-nya belum Completed).
7. WHEN SPV_Marketing memilih sebuah Brand sebagai filter pada Dashboard, THE PMS SHALL menghitung seluruh indikator antrian kerja (Pending Reviews, Rejected Promos, Unread Feedback, dan Waiting for Execution) hanya berdasarkan Promo_Scenario dan Feedback_Record yang dimiliki oleh Brand tersebut.

### Requirement 3: Product Master

**User Story:** As a SPV_Marketing, I want mengelola data produk terpusat, so that data produk dapat dipakai ulang secara konsisten pada promo.

#### Acceptance Criteria

1. WHEN SPV_Marketing menambahkan produk dengan Product ID, Nama Produk, Kategori, HPP, Harga Jual, Status, dan Brand yang valid, THE PMS SHALL menyimpan produk ke Product_Master dengan dikaitkan ke tepat satu Brand.
2. IF SPV_Marketing menambahkan produk dengan Product ID yang sudah ada pada Brand yang sama (kombinasi Brand + Product ID sudah dipakai), THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan Product ID duplikat dalam Brand tersebut.
3. WHEN SPV_Marketing menambahkan produk dengan Product ID yang sama dengan produk pada Brand lain, THE PMS SHALL menampilkan peringatan bahwa Product ID tersebut sudah dipakai pada Brand lain namun tetap mengizinkan penyimpanan karena keunikan Product ID berlaku per Brand (contoh: Product ID 12345 pada Brand Kalova dan Product ID 12345 pada Brand AMK keduanya diperbolehkan).
4. THE PMS SHALL menegakkan keunikan produk semata-mata pada kombinasi (Brand + Product ID) dan SHALL tidak pernah menerapkan batasan keunikan pada Nama Produk.
5. WHEN SPV_Marketing menambahkan produk dengan Nama Produk yang sama dengan produk lain pada Brand berbeda maupun pada Brand yang sama, THE PMS SHALL mengizinkan penyimpanan tanpa menolaknya karena Nama Produk tidak memiliki batasan keunikan (contoh: Brand Kalova Product ID 12345 "Kaluna" dan Brand AMK Product ID 99887 "Kaluna" keduanya valid).
6. THE PMS SHALL membatasi nilai Status produk hanya pada Active, Inactive, atau Archived, dengan ketentuan: Active berarti produk dapat dipilih pada promo baru; Inactive berarti produk tidak dapat dipilih pada promo baru namun tetap terlihat pada catatan historis; Archived berarti produk disembunyikan dari pemilihan produk normal namun tetap dipertahankan untuk keperluan pelaporan/historis.
7. IF SPV_Marketing menambahkan produk tanpa Brand atau dengan Brand yang tidak ada, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi Brand.
8. WHEN SPV_Marketing menyunting sebuah produk, THE PMS SHALL menyimpan perubahan field produk tersebut di Product_Master.
9. WHEN SPV_Marketing menghapus sebuah produk yang tidak direferensikan oleh Promo_Scenario mana pun, THE PMS SHALL menghapus produk tersebut dari Product_Master.
10. IF SPV_Marketing menghapus sebuah produk yang direferensikan oleh satu atau lebih Promo_Scenario, THEN THE PMS SHALL menolak penghapusan permanen dan menampilkan pesan bahwa produk harus diarsipkan (Archive) sebagai gantinya agar data promo historis tetap valid.
11. WHEN SPV_Marketing mengarsipkan sebuah produk, THE PMS SHALL menandai produk tersebut dengan Status Archived tanpa menghapus datanya.
12. WHEN SPV_Marketing mengimpor berkas Excel atau CSV berisi data produk yang valid, THE PMS SHALL membuat satu entri produk untuk setiap baris yang valid pada berkas tersebut.
13. IF berkas impor berisi baris dengan data tidak valid atau terjadi error sistem yang mencegah penyimpanan baris, THEN THE PMS SHALL memperlakukan baris tersebut sebagai gagal impor dan melaporkannya dalam daftar baris yang gagal diimpor.
14. WHEN SPV_Marketing memasukkan kata kunci pencarian, THE PMS SHALL menampilkan produk yang Nama Produk atau Product ID-nya mengandung kata kunci tersebut.
15. WHEN SPV_Marketing menerapkan filter Brand pada Product_Master, THE PMS SHALL menampilkan hanya produk yang dimiliki oleh Brand tersebut.
16. WHEN SPV_Marketing membuat sebuah produk, THE PMS SHALL mencatat Created By dan Created At; dan WHEN SPV_Marketing mengubah produk tersebut, THE PMS SHALL memperbarui Updated At.
17. WHILE konteks Brand global (Global Brand Selector) sedang aktif, THE PMS SHALL tetap menampilkan kolom Brand pada listing Product_Master agar visibilitas Brand terjaga untuk keperluan export, import, dan review operasional.

### Requirement 4: Cost Configuration

**User Story:** As a SPV_Marketing, I want mengatur komponen biaya per Brand, so that setiap brand memiliki dasar biaya sendiri yang dipakai pada simulasi promo brand tersebut.

> **Catatan keputusan arsitektur:** Cost_Configuration dimiliki **per Brand** (Brand → Cost_Configuration), bukan global. Keputusan ini **secara sengaja menyimpang** dari PRD awal yang menetapkan global cost configuration, agar tiap brand dapat mencerminkan struktur biaya marketplace yang berbeda (contoh: Admin Fee Kalova 8%, Admin Fee AMK 10%).

#### Acceptance Criteria

1. THE PMS SHALL menyimpan, untuk setiap Brand, komponen biaya berikut dalam satuan persen: Admin Fee, Shipping Fee, Promo Xtra, Fee Pesanan, Campaign Fee, Promosi Fee, Marketing Fee, Ads Spending, Affiliate Commission, dan Operating Cost.
2. THE PMS SHALL mengaitkan setiap set Cost_Configuration dengan tepat satu Brand, sehingga setiap Brand memiliki Cost_Configuration tersendiri yang terpisah dari Brand lain.
3. WHEN SPV_Marketing mengubah nilai komponen Cost_Configuration sebuah Brand, THE PMS SHALL menyimpan nilai baru tersebut sebagai konfigurasi aktif untuk Brand tersebut tanpa memengaruhi Cost_Configuration Brand lain.
4. WHEN sebuah simulasi promo dihitung, THE PMS SHALL menggunakan Cost_Configuration aktif terkini milik Brand yang memiliki promo tersebut.
5. IF SPV_Marketing memasukkan satu atau lebih nilai komponen biaya di luar rentang 0 sampai 100 persen, THEN THE PMS SHALL menolak seluruh perubahan, dan penolakan perubahan tersebut SHALL tetap berlaku meskipun penampilan pesan validasi gagal.

### Requirement 5: Promo Templates

**User Story:** As a SPV_Marketing, I want memakai dan mengelola template promo, so that pembuatan promo menjadi lebih cepat.

#### Acceptance Criteria

1. THE PMS SHALL menyediakan template bawaan: Buy X Discount Y%, Buy X Get Free Gift, Voucher Discount, Flash Sale, dan Bundle Promo.
2. WHEN SPV_Marketing membuat Promo_Template baru, THE PMS SHALL menyimpan template tersebut ke daftar template.
3. THE PMS SHALL mengizinkan penyimpanan Promo_Template dalam jumlah tidak terbatas.
4. WHEN SPV_Marketing menyunting sebuah Promo_Template, THE PMS SHALL menyimpan perubahan template tersebut.
5. WHEN SPV_Marketing menghapus sebuah Promo_Template, THE PMS SHALL menghapus template tersebut dari daftar template.
6. IF penyimpanan Promo_Template gagal akibat error validasi atau error sistem, THEN THE PMS SHALL menampilkan pesan error yang spesifik dan mempertahankan template tanpa kehilangan data.

### Requirement 6: Campaign Management

**User Story:** As a SPV_Marketing, I want mengelola campaign sebagai wadah promo, so that promo dapat dikelompokkan secara terstruktur.

#### Acceptance Criteria

1. WHEN SPV_Marketing membuat Campaign dengan Nama Campaign, Brand, Tanggal Mulai, dan Tanggal Selesai yang valid, THE PMS SHALL menyimpan Campaign dengan Status awal Draft dan dikaitkan ke tepat satu Brand.
2. IF SPV_Marketing membuat Campaign dengan Tanggal Selesai lebih awal daripada Tanggal Mulai, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi tanggal.
3. IF SPV_Marketing membuat Campaign tanpa Brand atau dengan Brand yang tidak ada, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi Brand.
4. THE PMS SHALL membatasi Status Campaign hanya pada nilai Draft, Active, Completed, atau Archived.
5. WHEN SPV_Marketing menyunting sebuah Campaign, THE PMS SHALL menyimpan perubahan field Campaign tersebut.
6. IF perubahan pada sebuah Campaign mengandung error validasi (misalnya Tanggal Selesai lebih awal daripada Tanggal Mulai atau Brand tidak valid), THEN THE PMS SHALL memblokir penyimpanan perubahan hingga error tersebut diperbaiki.
7. WHEN SPV_Marketing menghapus sebuah Campaign yang tidak memiliki Promo_Scenario terkait, THE PMS SHALL menghapus Campaign tersebut.
8. IF SPV_Marketing menghapus sebuah Campaign yang masih memiliki satu atau lebih Promo_Scenario terkait, THEN THE PMS SHALL menolak penghapusan permanen dan menampilkan pesan bahwa Campaign harus diarsipkan (Archive) sebagai gantinya agar riwayat campaign tetap tersedia untuk pelaporan dan audit.
9. WHEN SPV_Marketing mengarsipkan sebuah Campaign, THE PMS SHALL menandai Campaign tersebut dengan Status Archived tanpa menghapus datanya.
10. WHEN SPV_Marketing membuat Promo_Scenario, THE PMS SHALL mewajibkan promo tersebut dikaitkan dengan tepat satu Campaign yang sudah ada.
11. THE PMS SHALL mendukung relasi satu-ke-banyak antara Campaign dan Promo_Scenario, sehingga satu Campaign dapat menampung banyak Promo_Scenario sedangkan setiap Promo_Scenario hanya menjadi bagian dari satu Campaign.
12. IF SPV_Marketing mengaitkan Promo_Scenario ke sebuah Campaign yang Brand-nya berbeda dengan Brand Promo_Scenario tersebut, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan bahwa Brand promo harus sama dengan Brand campaign-nya.
13. WHEN SPV_Marketing membuat sebuah Campaign, THE PMS SHALL mencatat Created By dan Created At; dan WHEN SPV_Marketing mengubah Campaign tersebut, THE PMS SHALL memperbarui Updated At.
14. IF penyimpanan Campaign gagal akibat error sistem (misalnya kegagalan konektivitas basis data) meskipun seluruh input valid, THEN THE PMS SHALL membatalkan penyimpanan dan menampilkan pesan error sistem yang dibedakan dari pesan validasi input.

### Requirement 7: Promo Scenario - Basic Information

**User Story:** As a SPV_Marketing, I want membuat promo dengan informasi dasar termasuk Brand dan Promo Type, so that promo memiliki identitas, kepemilikan brand, dan jenis yang jelas.

> **Catatan prioritas:** Field Brand dan Promo_Type pada Basic Information bersifat **MANDATORY (MVP)**. Promo_Type diperlukan karena tiap jenis promo membutuhkan logika bisnis berbeda serta mempermudah filtering, pelaporan, dan pengembangan fitur ke depan.

#### Acceptance Criteria

1. WHEN SPV_Marketing membuat Promo_Scenario dengan Nama Promo, Brand, Promo_Type, Campaign, Tanggal Mulai, dan Tanggal Selesai yang valid, THE PMS SHALL menyimpan promo dengan Status awal Draft dan dikaitkan ke tepat satu Brand serta tepat satu Campaign.
2. IF SPV_Marketing membuat Promo_Scenario tanpa mengaitkannya ke sebuah Campaign yang sudah ada, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan bahwa promo harus menjadi bagian dari tepat satu Campaign.
3. IF SPV_Marketing membuat atau menyunting Promo_Scenario dengan Campaign yang Brand-nya berbeda dengan Brand promo tersebut, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan bahwa Brand promo harus sama dengan Brand campaign-nya.
4. IF SPV_Marketing membuat Promo_Scenario dengan Tanggal Selesai lebih awal daripada Tanggal Mulai, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi tanggal.
5. IF SPV_Marketing membuat Promo_Scenario tanpa Brand atau dengan Brand yang tidak ada, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi Brand.
6. THE PMS SHALL membatasi nilai Promo_Type hanya pada Buy X Discount, Buy X Get Gift, Voucher, Flash Sale, atau Bundle Promo.
7. IF SPV_Marketing membuat Promo_Scenario tanpa memilih Promo_Type yang valid, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan validasi Promo_Type.
8. THE PMS SHALL membatasi Status Promo_Scenario hanya pada nilai Draft, Review, Approved, Rejected, Active, atau Completed.
9. WHEN SPV_Marketing menyunting Basic Information sebuah Promo_Scenario, THE PMS SHALL menyimpan perubahan tersebut.
10. IF perubahan Basic Information menghasilkan keadaan tidak valid (misalnya Tanggal Selesai lebih awal daripada Tanggal Mulai), THEN THE PMS SHALL menolak penyimpanan dan mempertahankan data Promo_Scenario sebelumnya.
11. WHEN SPV_Marketing membuat sebuah Promo_Scenario, THE PMS SHALL mencatat Created By dan Created At; dan WHEN SPV_Marketing mengubah Promo_Scenario tersebut, THE PMS SHALL memperbarui Updated At.
12. WHEN SPV_Marketing membuat sebuah Promo_Scenario, THE PMS SHALL mengizinkan SPV_Marketing membuat sebuah Campaign baru secara inline dalam alur pembuatan Promo_Scenario tersebut, sehingga pengguna dapat menentukan promo terlebih dahulu kemudian membuat Campaign-nya.
13. WHEN SPV_Marketing membuat Campaign baru secara inline dari alur Promo_Scenario, THE PMS SHALL menerapkan seluruh validasi Campaign yang berlaku (Brand wajib, Tanggal Selesai tidak lebih awal daripada Tanggal Mulai, Status awal Draft, serta pencatatan field audit Created By, Created At, dan Updated At).
14. IF Campaign yang dibuat inline memiliki Brand yang berbeda dengan Brand Promo_Scenario yang sedang dibuat, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan bahwa Brand campaign harus sama dengan Brand promo.

### Requirement 8: Dynamic Rule Builder

**User Story:** As a SPV_Marketing, I want menambah aturan promo tanpa batas, so that saya dapat menyusun skema promo bertingkat.

#### Acceptance Criteria

1. WHEN SPV_Marketing menambahkan Rule berisi minimum quantity dan benefit (diskon persen atau free gift), THE PMS SHALL menambahkan Rule tersebut ke Promo_Scenario.
2. THE PMS SHALL mengizinkan penambahan Rule dalam jumlah tidak terbatas pada satu Promo_Scenario.
3. IF SPV_Marketing menambahkan Rule dengan minimum quantity kurang dari 1, THEN THE PMS SHALL menolak Rule tersebut dan menampilkan pesan validasi.
4. WHEN SPV_Marketing menghapus sebuah Rule dari Promo_Scenario, THE PMS SHALL menghapus Rule tersebut dari promo.
5. WHEN beberapa Rule berlaku untuk suatu quantity pembelian, THE PMS SHALL memilih Rule dengan minimum quantity terpenuhi yang tertinggi sebagai aturan yang diterapkan.

### Requirement 9: Product Selection

**User Story:** As a SPV_Marketing, I want memilih produk dari Product Master ke dalam promo, so that data produk terisi otomatis dan konsisten.

#### Acceptance Criteria

1. WHEN SPV_Marketing memilih sebuah produk ke dalam Promo_Scenario, THE PMS SHALL menarik Product ID, Nama Produk, HPP, dan Harga Jual dari Product_Master untuk produk tersebut.
2. THE PMS SHALL mengizinkan penambahan banyak produk pada satu Promo_Scenario.
3. IF SPV_Marketing memilih produk yang sudah ada dalam Promo_Scenario tersebut, THEN THE PMS SHALL menolak penambahan ganda dan mempertahankan daftar produk saat ini.
4. WHEN SPV_Marketing menghapus sebuah produk dari Promo_Scenario, THE PMS SHALL menghapus produk tersebut dari daftar produk promo.
5. WHEN SPV_Marketing memasukkan kata kunci pencarian berupa Product ID atau Nama Produk saat memilih produk untuk sebuah Promo_Scenario, THE PMS SHALL menampilkan hanya produk yang Product ID atau Nama Produk-nya mengandung kata kunci tersebut dan dibatasi pada produk yang dimiliki oleh Brand promo tersebut.
6. WHEN SPV_Marketing menempelkan (paste) banyak Product ID yang dipisahkan oleh spasi atau baris baru saat memilih produk, THE PMS SHALL menambahkan sekaligus seluruh produk yang Product ID-nya cocok dalam Brand promo tersebut ke Promo_Scenario, dan SHALL melewati (skip) Product ID yang hanya cocok dengan produk pada Brand lain tanpa membatalkan keseluruhan operasi.
7. THE PMS SHALL mendukung pemilihan banyak produk sekaligus (multi-select) untuk ditambahkan ke Promo_Scenario dalam satu tindakan.
8. WHEN SPV_Marketing menambahkan banyak Product ID sekaligus, THE PMS SHALL melaporkan Product ID yang tidak cocok dengan produk mana pun dalam Brand promo tersebut sebagai daftar tidak ditemukan (unmatched).
9. IF satu atau lebih Product ID yang ditambahkan secara massal sudah ada dalam Promo_Scenario tersebut, THEN THE PMS SHALL melewati (skip) Product ID tersebut tanpa menampilkan error dan tetap menambahkan Product ID lain yang valid.
10. WHEN SPV_Marketing memilih produk ke dalam Promo_Scenario, THE PMS SHALL mereferensikan produk terpilih melalui Product record dari Product_Master (teridentifikasi sebagai Product ID dalam Brand-nya) sebagai source of truth, dan SHALL tidak pernah menggunakan Nama Produk sebagai kunci relasi/foreign key.
11. WHEN SPV_Marketing membuka daftar produk yang dapat dipilih untuk sebuah Promo_Scenario, THE PMS SHALL menampilkan hanya produk yang dimiliki oleh Brand yang sama dengan Brand Promo_Scenario tersebut, sehingga produk dari Brand lain yang berbeda (meskipun memiliki Nama Produk yang sama) tidak ditampilkan (contoh: promo Brand Kalova hanya menampilkan produk Kalova; produk AMK atau Chanira dengan nama yang sama disembunyikan).
12. IF SPV_Marketing mencoba menambahkan produk yang dimiliki oleh Brand yang berbeda dengan Brand Promo_Scenario tersebut, THEN THE PMS SHALL menolak penambahan dan menampilkan pesan bahwa produk harus berasal dari Brand yang sama dengan promo.
13. WHEN SPV_Marketing memilih produk untuk sebuah Promo_Scenario baru, THE PMS SHALL hanya mengizinkan pemilihan produk berstatus Active dan SHALL tidak menampilkan produk berstatus Inactive atau Archived sebagai pilihan.
14. WHERE sebuah produk berstatus Inactive atau Archived sudah direferensikan oleh Promo_Scenario yang ada sebelumnya, THE PMS SHALL mempertahankan referensi produk tersebut sebagai valid pada catatan historis tanpa menghapusnya dari promo terkait.

### Requirement 10: Promo Logic

**User Story:** As a SPV_Marketing, I want sistem menghitung harga promo dari aturan yang berlaku, so that hasil promo konsisten untuk seluruh produk terpilih.

#### Acceptance Criteria

1. WHEN sebuah Rule diskon persen diterapkan pada produk, THE PMS SHALL menghitung Harga Promo per pcs sebagai Harga_Jual dikurangi (Harga_Jual dikali persentase diskon).
2. WHEN suatu quantity pembelian diberikan, THE PMS SHALL menghitung total harga sebagai Harga Promo per pcs dikali quantity.
3. THE PMS SHALL menerapkan Rule promo yang sama ke seluruh produk yang dipilih dalam Promo_Scenario tersebut.

### Requirement 11: Promo Simulator

**User Story:** As a SPV_Marketing, I want menjalankan simulasi kelayakan promo, so that saya dapat menilai promo sebelum approval.

#### Acceptance Criteria

1. WHEN SPV_Marketing menjalankan simulasi untuk sebuah Promo_Scenario, THE PMS SHALL menghitung dan menampilkan per produk: Harga Normal, Harga Promo, Potongan, Margin (Rp), Margin (%), NPM (Rp), dan NPM (%).
2. WHEN menghitung NPM, THE PMS SHALL menggunakan HPP produk dan seluruh komponen Cost_Configuration aktif milik Brand yang memiliki Promo_Scenario tersebut (Admin Fee, Shipping Fee, Promo Xtra, Fee Pesanan, Campaign Fee, Promosi Fee, Marketing Fee, Ads Spending, Affiliate Commission, Operating Cost).
3. WHEN parameter promo atau Cost_Configuration milik Brand promo tersebut berubah, THE PMS SHALL menghitung ulang hasil simulasi secara real-time menggunakan Cost_Configuration aktif Brand promo tersebut.
4. WHEN menghitung Margin (Rp), THE PMS SHALL menggunakan Harga Promo dikurangi HPP produk.
5. IF Harga Promo lebih kecil daripada HPP produk, THEN THE PMS SHALL menampilkan nilai Margin negatif yang sebenarnya tanpa membatasinya pada nol.
6. WHEN menampilkan Potongan sebuah produk, THE PMS SHALL menghitung Potongan sebagai Harga Normal dikurangi Harga Promo.
7. IF Cost_Configuration milik Brand promo tersebut tidak aktif atau tidak tersedia saat simulasi dijalankan, THEN THE PMS SHALL menunda perhitungan NPM dan menampilkan pesan bahwa Cost_Configuration aktif belum tersedia, serta hanya menghitung NPM ketika Cost_Configuration Brand tersebut aktif.
8. WHEN SPV_Marketing menjalankan simulasi untuk sebuah Promo_Scenario, THE PMS SHALL menampilkan secara jelas Cost_Configuration yang sedang dipakai dengan penanda "Active Cost Configuration" milik Brand promo tersebut beserta Last Updated Date (tanggal terakhir Cost_Configuration tersebut diperbarui), agar pengguna dapat mempercayai hasil simulasi.

### Requirement 12: Approval System

**User Story:** As a SPV_Marketing, I want mengubah status approval promo, so that promo yang siap dapat diteruskan ke Admin Marketplace.

#### Acceptance Criteria

1. WHEN SPV_Marketing mengubah status sebuah Promo_Scenario, THE PMS SHALL mengizinkan perubahan ke nilai Draft, Review, Approved, atau Rejected.
2. WHEN sebuah Promo_Scenario diubah menjadi Approved, THE PMS SHALL menampilkan promo tersebut pada halaman Admin_Marketplace.
3. WHEN sebuah Promo_Scenario berstatus Approved, THE PMS SHALL menjamin promo tersebut selalu tampil pada halaman Admin_Marketplace.
4. IF sebuah Promo_Scenario berstatus Approved mengalami kendala teknis penampilan (misalnya data rusak/corrupt atau galat render) yang dapat merusak tata letak halaman, THEN THE PMS SHALL diizinkan menyembunyikan promo tersebut dari halaman Admin_Marketplace untuk menjaga integritas tampilan.
5. WHEN status sebuah Promo_Scenario berubah, THE PMS SHALL mencatat perubahan tersebut beserta tanggalnya ke dalam riwayat approval.
6. WHERE sebuah Promo_Scenario berstatus selain Approved, THE PMS SHALL menyembunyikan promo tersebut dari halaman Admin_Marketplace.

### Requirement 13: Approved Promos

**User Story:** As a SPV_Marketing, I want melihat daftar promo yang sudah disetujui, so that saya memiliki rujukan promo aktif yang sah.

#### Acceptance Criteria

1. WHEN halaman Approved_Promos dimuat, THE PMS SHALL menampilkan seluruh Promo_Scenario berstatus Approved tanpa memandang jumlah produk yang terkait.
2. WHEN menampilkan setiap promo pada Approved_Promos, THE PMS SHALL menampilkan Nama Promo, Brand, Campaign, Jumlah Produk, Tanggal Approve, dan Status Eksekusi.
3. WHEN SPV_Marketing menerapkan filter Brand pada Approved_Promos, THE PMS SHALL menampilkan hanya Promo_Scenario Approved yang dimiliki oleh Brand tersebut.

### Requirement 14: Admin Execution Board

**User Story:** As a Admin_Marketplace, I want melihat promo yang disetujui sebagai panduan setup, so that saya dapat menyiapkan promo di marketplace.

> **Catatan prioritas:** Penyimpanan feedback sebagai Feedback_Record terstruktur dengan riwayat (Feedback History) bersifat **MANDATORY (MVP)** untuk menjaga riwayat komunikasi, auditabilitas, dan pelacakan kendala.

#### Acceptance Criteria

1. WHEN Admin_Marketplace membuka Admin_Execution_Board, THE PMS SHALL menampilkan hanya Promo_Scenario berstatus Approved beserta Campaign, Promo, dan Products terkait.
2. IF tidak ada Promo_Scenario berstatus Approved atau sistem gagal mengambil data promo, THEN THE PMS SHALL menampilkan pesan yang menjelaskan penyebabnya (tidak ada promo Approved atau terjadi error sistem).
3. IF sistem gagal mengambil data promo, THEN THE PMS SHALL menampilkan pesan error sistem meskipun terdapat Promo_Scenario berstatus Approved, dan apabila kegagalan tersebut bersamaan dengan tidak adanya promo Approved, THE PMS SHALL memprioritaskan penampilan pesan error sistem.
4. WHEN seorang pengguna yang memiliki akses ke sebuah promo Approved (SPV_Marketing maupun Admin_Marketplace) mengirim feedback pada promo tersebut, THE PMS SHALL menyimpan feedback tersebut sebagai Feedback_Record terstruktur berisi Feedback Message, Created By User (pengguna pembuat feedback), Created Date, dan Promo Reference yang merujuk ke promo bersangkutan.
5. THE PMS SHALL menyimpan setiap Feedback_Record sebagai catatan terpisah sehingga satu Promo_Scenario dapat memiliki banyak Feedback_Record sebagai utas diskusi dua arah antar peran.
6. WHEN sebuah promo Approved menampilkan feedback, THE PMS SHALL menampilkan seluruh Feedback_Record terkait promo tersebut beserta Created By User dan Created Date untuk setiap catatan.

### Requirement 15: Campaign History

**User Story:** As a SPV_Marketing, I want melihat riwayat seluruh campaign, so that saya dapat menelusuri campaign yang pernah dibuat.

#### Acceptance Criteria

1. WHEN halaman Campaign History dimuat, THE PMS SHALL menampilkan seluruh Campaign dengan Nama Campaign, Brand, Tanggal Dibuat, Tanggal Berjalan, Status, dan Jumlah Promo.
2. WHEN SPV_Marketing menerapkan filter Brand, Status, atau Tanggal, THE PMS SHALL menampilkan hanya Campaign yang memenuhi kriteria filter tersebut.
3. WHEN halaman Campaign History dimuat, THE PMS SHALL menampilkan Campaign meskipun Campaign tersebut memiliki Jumlah Promo nol.

### Requirement 16: Promo History

**Prioritas: MANDATORY (MVP)** — kapabilitas pencarian promo historis lintas campaign

**User Story:** As a SPV_Marketing, I want melihat dan mencari riwayat seluruh promo lintas campaign, so that saya dapat menelusuri dan menemukan kembali promo yang pernah dibuat dengan cepat sebagai referensi.

> **Catatan:** Requirement ini mengonsolidasikan kapabilitas pencarian promo historis lintas campaign (sebelumnya Promo Library) ke dalam Promo History. Promo History menampilkan daftar riwayat promo sekaligus menyediakan pencarian dan kombinasi filter lintas campaign. Kapabilitas pencarian lintas campaign bersifat MANDATORY (MVP).

#### Acceptance Criteria

1. WHEN halaman Promo History dimuat, THE PMS SHALL menampilkan seluruh Promo_Scenario historis lintas Campaign dengan Nama Promo, Brand, Promo_Type, Campaign, Jumlah Produk, Tanggal Dibuat, dan Status.
2. WHEN SPV_Marketing memasukkan kata kunci pencarian, THE PMS SHALL menampilkan hanya Promo_Scenario yang Nama Promo-nya mengandung kata kunci tersebut.
3. WHEN SPV_Marketing menerapkan filter Brand, Campaign, Promo_Type, Status, atau Date Range, THE PMS SHALL menampilkan hanya Promo_Scenario yang memenuhi kriteria filter tersebut.
4. WHEN SPV_Marketing menerapkan kombinasi beberapa filter (Brand, Campaign, Promo_Type, Status, dan/atau Date Range) secara bersamaan, THE PMS SHALL menampilkan hanya Promo_Scenario yang memenuhi seluruh kriteria filter yang diterapkan (kombinasi AND).
5. WHEN SPV_Marketing menerapkan filter Date Range, THE PMS SHALL menampilkan hanya Promo_Scenario yang Tanggal Dibuat-nya berada dalam rentang tanggal tersebut, termasuk tanggal batas awal dan tanggal batas akhir.
6. IF tidak ada Promo_Scenario yang memenuhi kriteria pencarian atau kombinasi filter, THEN THE PMS SHALL menampilkan daftar kosong dengan pesan tidak ada hasil.
7. WHEN SPV_Marketing menghapus seluruh filter dan kata kunci pencarian yang diterapkan pada Promo History, THE PMS SHALL menampilkan kembali seluruh Promo_Scenario historis lintas campaign.

### Requirement 17: Approval History

**User Story:** As a SPV_Marketing, I want melihat riwayat approval promo, so that saya dapat mengaudit keputusan approval.

#### Acceptance Criteria

1. WHEN halaman Approval History dimuat, THE PMS SHALL menampilkan setiap catatan approval dengan Nama Promo, Campaign, Tanggal Approval, dan Status Approval.
2. WHEN status approval sebuah Promo_Scenario berubah, THE PMS SHALL menambahkan satu catatan baru ke Approval History.
3. IF penambahan catatan ke Approval History gagal saat perubahan status approval terjadi, THEN THE PMS SHALL membatalkan (rollback) perubahan status tersebut untuk menjaga integritas audit.

### Requirement 18: Execution Status

**User Story:** As a SPV_Marketing, I want memantau status pelaksanaan promo, so that saya mengetahui progres implementasi promo.

#### Acceptance Criteria

1. THE PMS SHALL membatasi Execution_Status sebuah promo hanya pada nilai Approved, Sent to Admin, Marketplace Setup, atau Completed.
2. WHEN halaman Execution Status dimuat, THE PMS SHALL menampilkan setiap promo Approved beserta Execution_Status terkininya.
3. WHEN Execution_Status sebuah promo diperbarui, THE PMS SHALL menyimpan nilai status baru tersebut untuk promo bersangkutan.
4. IF operasi penyimpanan Execution_Status gagal, THEN THE PMS SHALL membatalkan pembaruan dan mempertahankan Execution_Status sebelumnya.

### Requirement 19: Brand Management

**Prioritas: MANDATORY (MVP)**

**User Story:** As a SPV_Marketing, I want mengelola data brand secara terpusat, so that sistem dapat menjalankan operasi multi-brand dan setiap data promo terkait dengan brand yang tepat.

#### Acceptance Criteria

1. WHEN SPV_Marketing membuat Brand dengan Brand ID, Brand Name, Display Name, dan Status yang valid, THE PMS SHALL menyimpan Brand tersebut ke daftar Brand.
2. IF SPV_Marketing membuat Brand dengan Brand ID yang sudah ada, THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan Brand ID duplikat.
3. WHEN SPV_Marketing menyunting sebuah Brand, THE PMS SHALL menyimpan perubahan field Brand tersebut hanya bila seluruh validasi lolos dan tidak ada batasan yang dilanggar.
4. IF perubahan pada sebuah Brand mengandung error validasi atau melanggar batasan (constraint), THEN THE PMS SHALL menolak penyimpanan dan menampilkan pesan error yang sesuai.
5. WHEN SPV_Marketing menghapus sebuah Brand yang tidak memiliki Product, Campaign, atau Promo_Scenario terkait, THE PMS SHALL menghapus Brand tersebut.
6. IF SPV_Marketing menghapus sebuah Brand yang masih memiliki Product, Campaign, atau Promo_Scenario terkait, THEN THE PMS SHALL menolak penghapusan dan menampilkan pesan bahwa Brand masih memiliki data terkait.
7. WHEN SPV_Marketing mengarsipkan sebuah Brand, THE PMS SHALL menandai Brand tersebut sebagai arsip tanpa menghapus datanya.
8. THE PMS SHALL menjamin setiap Product, Campaign, dan Promo_Scenario dimiliki oleh tepat satu Brand.
9. THE PMS SHALL mengizinkan penyimpanan banyak Brand (contoh: Kalova, Chanira, AMK, ATRIA).

### Requirement 20: Margin Health (Nice to Have)

**Prioritas: NICE TO HAVE (Opsional)**

**User Story:** As a SPV_Marketing, I want melihat indikator Margin Health (Profitability Indicator) berbasis hasil simulasi, so that saya memiliki dukungan analisis tanpa mengubah proses approval.

#### Acceptance Criteria

1. WHEN sebuah simulasi promo selesai dihitung untuk sebuah produk, THE PMS SHALL menentukan Margin_Health berdasarkan nilai NPM (%): NPM 20 persen atau lebih menghasilkan Healthy; NPM dari 10 persen sampai kurang dari 20 persen menghasilkan Warning; NPM kurang dari 10 persen menghasilkan Risky (nilai batas diperlakukan sebagai kategori yang lebih tinggi: NPM tepat 10 persen menghasilkan Warning dan NPM tepat 20 persen menghasilkan Healthy).
2. THE PMS SHALL membatasi nilai Margin_Health hanya pada Healthy, Warning, atau Risky.
3. THE PMS SHALL memperlakukan Margin_Health hanya sebagai indikator analisis/pendukung keputusan (Profitability Indicator) yang TIDAK membuat keputusan bisnis dan TIDAK mengubah Status approval Promo_Scenario maupun memengaruhi proses approval.
4. WHEN nilai NPM (%) hasil simulasi berubah, THE PMS SHALL menghitung ulang Margin_Health agar konsisten dengan nilai NPM terkini.

### Requirement 21: Attachments (Nice to Have)

**Prioritas: NICE TO HAVE (Opsional)**

**User Story:** As a SPV_Marketing, I want mengunggah berkas pendukung pada Promo_Scenario, so that seluruh informasi terkait promo terpusat dan tidak bergantung pada chat atau folder eksternal.

#### Acceptance Criteria

1. WHEN SPV_Marketing mengunggah berkas pada sebuah Promo_Scenario, THE PMS SHALL menyimpan Attachment dengan Attachment Name, File URL, Uploaded By, dan Upload Date yang terkait dengan promo tersebut.
2. THE PMS SHALL mengizinkan banyak Attachment pada satu Promo_Scenario (contoh: Promo Brief, Banner, Supporting Spreadsheet, Reference Documents).
3. WHEN SPV_Marketing menghapus sebuah Attachment dari Promo_Scenario, THE PMS SHALL menghapus Attachment tersebut dari daftar lampiran promo.
4. WHEN SPV_Marketing membuka sebuah Promo_Scenario, THE PMS SHALL menampilkan seluruh Attachment terkait beserta Attachment Name, Uploaded By, dan Upload Date.

### Requirement 22: Promo Execution (Nice to Have)

**Prioritas: NICE TO HAVE (Opsional)**

**User Story:** As a SPV_Marketing, I want satu tampilan Promo Execution yang menggabungkan daftar promo Approved dan status pelaksanaannya, so that navigasi lebih sederhana dan pemantauan progres lebih mudah.

> **Catatan:** Requirement ini merupakan penyederhanaan UI yang bersifat opsional. Kapabilitas dasar Approved Promos (Requirement 13) dan Execution Status (Requirement 18) tetap bersifat **MANDATORY** dan harus utuh; penggabungan tampilan hanya merupakan peningkatan opsional.

#### Acceptance Criteria

1. WHERE fitur Promo_Execution diaktifkan, THE PMS SHALL menampilkan satu halaman Promo_Execution yang menggabungkan daftar promo Approved beserta Execution_Status masing-masing, dan penampilan halaman gabungan tersebut SHALL berfungsi setiap kali fitur dalam keadaan aktif.
2. WHERE fitur Promo_Execution diaktifkan, THE PMS SHALL menampilkan Execution_Status setiap promo dengan nilai Approved, Sent to Admin, Marketplace Setup, atau Completed.
3. WHERE fitur Promo_Execution diaktifkan, THE PMS SHALL tetap mempertahankan seluruh kapabilitas Approved_Promos (Requirement 13) dan Execution_Status (Requirement 18) sebagai sumber data tampilan gabungan.

### Requirement 23: Audit Fields

**User Story:** As a SPV_Marketing, I want sistem mencatat siapa membuat dan kapan setiap entitas utama dibuat serta diubah, so that perubahan data dapat ditelusuri dan diaudit.

> **Catatan:** Requirement ini bersifat lintas-fungsi (cross-cutting) dan melengkapi kriteria audit yang sudah tercantum pada Requirement 3 (Product Master), Requirement 6 (Campaign Management), dan Requirement 7 (Promo Scenario - Basic Information).

#### Acceptance Criteria

1. THE PMS SHALL melekatkan field audit Created By, Created At, dan Updated At pada setiap entitas Brand, Campaign, Promo_Scenario, dan Product.
2. WHEN sebuah Brand, Campaign, Promo_Scenario, atau Product dibuat, THE PMS SHALL mencatat Created By dengan pengguna pembuat entitas tersebut dan Created At dengan waktu pembuatan.
3. WHEN sebuah Brand, Campaign, Promo_Scenario, atau Product diubah, THE PMS SHALL memperbarui Updated At dengan waktu modifikasi terakhir.
4. THE PMS SHALL mempertahankan nilai Created By dan Created At tidak berubah setelah entitas dibuat, meskipun entitas tersebut kemudian dimodifikasi.

### Requirement 24: Promo Clone

**Prioritas: MANDATORY (MVP)**

**User Story:** As a SPV_Marketing, I want menduplikasi sebuah Promo_Scenario yang sudah ada, so that saya dapat mempercepat penyiapan campaign berulang seperti Payday, Serbu Rabu, dan Flash Sale tanpa membuat ulang dari awal.

> **Catatan:** Requirement ini merupakan bagian dari MVP. Kapabilitas dasar pembuatan Promo_Scenario (Requirement 7) tetap menjadi sumber kebenaran; Promo Clone merupakan pintasan yang mempercepat pembuatan promo berulang.

#### Acceptance Criteria

1. WHEN SPV_Marketing menduplikasi sebuah Promo_Scenario yang sudah ada, THE PMS SHALL membuat sebuah Promo_Scenario baru dengan menyalin Promo_Type, Rules, dan Product List dari promo sumber.
2. WHEN sebuah Promo_Scenario diduplikasi, THE PMS SHALL menetapkan Status awal promo hasil klona menjadi Draft.
3. WHEN sebuah Promo_Scenario diduplikasi, THE PMS SHALL mengisi field audit promo hasil klona dengan Created By sama dengan pengguna yang melakukan klona dan Created At sama dengan waktu saat klona dilakukan.
4. WHEN sebuah Promo_Scenario diduplikasi, THE PMS SHALL mereferensikan produk pada promo hasil klona melalui identitas Product (Brand + Product ID) yang konsisten dengan Brand promo hasil klona, dan SHALL tidak pernah menggunakan Nama Produk sebagai kunci relasi.
