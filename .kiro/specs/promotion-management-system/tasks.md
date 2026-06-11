# Implementation Plan: Promotion Management System (PMS)

## Overview

Rencana implementasi ini menerjemahkan design PMS menjadi serangkaian coding task TypeScript yang inkremental dan test-driven. Pendekatan mengikuti arsitektur tiga lapis dengan domain layer murni (pure): tipe & repository foundation → domain logic murni → domain services → API/RBAC → UI sesuai wireframe → pengujian.

Sesuai **Final Task Plan Review**, delivery dibagi menjadi **Sprint 0 (fondasi)**, **tiga fase rilis MVP (v1, v1.1, v1.2)**, dan **fase Deployment Readiness** (kesiapan rilis berbasis kode/konfigurasi). Pembagian ini murni menata urutan & pengelompokan implementasi; tidak ada requirement atau fitur baru yang ditambahkan, dan tidak ada requirement MANDATORY yang diturunkan menjadi opsional. Penambahan task UX (Empty States, Loading States, peningkatan Product Import) dan Deployment Readiness seluruhnya masih berada dalam lingkup requirement yang sudah ada.

- **Sprint 0 — Fondasi UI & Aplikasi (Tasks 1–3):** Project Setup (tipe domain & fondasi persistence), Design System (komponen UI dasar/reusable termasuk **Empty State** dan **Loading State** reusable), App Shell (Layout Structure, Sidebar, Top Navigation), Global Brand Selector, Authentication Flow, dan Session Management. Tujuannya menetapkan fondasi yang konsisten sebelum pengembangan fitur sehingga seluruh modul berbagi shell, navigasi, konteks sesi, serta pola empty/loading state yang sama.
- **MVP v1 (Core Operational Workflow) (Tasks 4–17):** Authentication & RBAC, Brand Context (Brand Management), Product Master (termasuk peningkatan Import: Download Template, Import Validation Feedback, Import Summary), Cost Configuration, Campaign Management, Promo Scenario, Dynamic Rule Builder, Product Selection, **Promo Clone** (aksi frekuensi tinggi, dipindah ke v1), Promo Logic & Promo Simulator, Approval Workflow, Promo Execution, dan **Dashboard**. Inilah alur operasional harian SPV_Marketing dan Admin_Marketplace.
- **MVP v1.1 (Productivity & Historical Features) (Tasks 18–19):** Promo History (termasuk kapabilitas pencarian lintas campaign yang dikonsolidasikan).
- **MVP v1.2 (Secondary Management Features) (Tasks 20–25):** Feedback Thread, Approval History (halaman/listing), Promo Templates, Campaign History & Additional Reporting (reporting sekunder), serta Attachments dan tampilan gabungan Promo Execution (nice-to-have, feature-flagged).
- **Deployment Readiness (berbasis kode/konfigurasi) (Tasks 26–27):** Environment Configuration, Database Migration Strategy, dan Backup Strategy — HANYA aktivitas yang dapat diwujudkan via kode/konfigurasi (bukan prosedur operasional manual).
- **Property-Based Testing menyeluruh (bertahap/opsional, non-blocking) (Tasks 28–30):** seluruh Properti 1–45 dipertahankan sebagai referensi yang diterapkan progresif **tanpa menghambat rilis MVP**.

### Catatan Prioritas Pengembangan (Final Task Plan Review)

- **Operational Workflow didahulukan.** Bila perlu memprioritaskan, dahulukan **Operational Workflow (Sprint 0 + MVP v1)** di atas **Testing Infrastructure (PBT menyeluruh)** dan **Secondary Management Features (MVP v1.2)**.
- **Promo Clone dipromosikan ke MVP v1.** Karena merupakan aksi frekuensi tinggi yang mempercepat penyiapan promo berulang (Payday, Serbu Rabu, Flash Sale), Promo Clone (Req 24) ditempatkan di MVP v1 dan tetap **mandatory**.
- **Feedback Thread & Approval History (halaman) dipindah ke MVP v1.2.** Feedback berguna namun tidak kritis untuk rilis operasional pertama; Approval History adalah fitur governance/audit, bukan workflow operasional inti. **Catatan penting:** logika `ApprovalService.changeStatus` yang menulis Approval_History dalam transaksi tunggal dengan rollback (Req 17.2/17.3) **TETAP di MVP v1** sebagai bagian Approval Workflow (Task 14); yang dipindah ke v1.2 hanya **halaman/listing Approval History (Req 17.1)** beserta UI-nya.
- **Metrik sukses MVP:** SPV_Marketing dan Admin_Marketplace dapat menyelesaikan workflow promo harian (perencanaan promo, simulasi kelayakan, approval, dan eksekusi) **tanpa spreadsheet**.
- **Property-Based Testing bersifat non-blocking.** Seluruh definisi/anotasi Properti 1–45 beserta traceability **dipertahankan utuh**, namun implementasi PBT penuh **BUKAN blocker rilis MVP**. Untuk MVP cukup **Unit Tests, Integration Tests, dan Business Validation Tests** yang ditempatkan sebagai sub-task `*` dekat implementasi. Seluruh task PBT tetap ditandai opsional/bertahap dan ditempatkan setelah seluruh fase fitur (Tasks 28–30).

Stack: TypeScript. Disarankan menggunakan Vitest untuk unit/integration test dan fast-check untuk property-based test (JANGAN implementasi PBT dari nol).

## Tasks

### Sprint 0 — Fondasi UI & Aplikasi

- [x] 1. Project Setup, tipe domain, dan fondasi persistence
  - [x] 1.1 Inisialisasi proyek TypeScript dan toolchain pengujian
    - Buat struktur direktori berlapis: `src/domain`, `src/persistence`, `src/api`, `src/ui`, `tests`
    - Konfigurasi TypeScript (tsconfig strict), bundler/runtime, ESLint
    - Set up Vitest untuk unit/integration test dan fast-check untuk property-based test (sebagai dependency, belum menulis test)
    - _Requirements: (fondasi seluruh requirement)_

  - [x] 1.2 Definisikan tipe domain, enum, dan value object inti
    - Buat tipe `Brand`, `Product`, `CostConfiguration`, `Campaign`, `PromoScenario`, `Rule`, `FeedbackRecord`, `ApprovalHistoryEntry`, `Attachment`, dan `ProductRef` (identitas `{ brandId, productId }`)
    - Definisikan enum: `Role` (SPV_Marketing, Admin_Marketplace), `ProductStatus` (Active/Inactive/Archived), `CampaignStatus` (Draft/Active/Completed/Archived), `PromoStatus` (Draft/Review/Approved/Rejected/Active/Completed), `PromoType` (Buy X Discount/Buy X Get Gift/Voucher/Flash Sale/Bundle Promo), `ExecutionStatus` (Approved/Sent to Admin/Marketplace Setup/Completed), `MarginHealth` (Healthy/Warning/Risky), `BenefitType` (DiscountPercent/FreeGift)
    - Definisikan tipe `AuditFields` (createdBy, createdAt, updatedAt)
    - _Requirements: 3.6, 6.4, 7.6, 7.8, 18.1, 20.2, 23.1_

  - [x] 1.3 Implementasikan interface repository dan transaksi
    - Definisikan interface repository untuk Brand, Product, Campaign, PromoScenario, CostConfiguration, PromoTemplate, FeedbackRecord, ApprovalHistory, ExecutionStatus
    - Sediakan implementasi in-memory yang menegakkan integritas relasional dan operasi transaksi atomik (commit/rollback) untuk dipakai service & test
    - _Requirements: 19.8, 17.3, 18.4_

- [x] 2. Design System & App Shell (Layout, Sidebar, Top Navigation, Global Brand Selector, Empty/Loading States)
  - [x] 2.1 Bangun Design System (komponen UI dasar/reusable)
    - Implementasikan komponen UI dasar reusable: Button, Input/Form Field, Select/Dropdown, Table padat, Modal, Status Badge, Toast/Notification, dan layout primitives
    - Sediakan token desain (spacing, warna, tipografi) untuk konsistensi lintas modul; desktop-first sesuai prinsip UX
    - _Requirements: (fondasi UI seluruh modul)_

  - [x] 2.2 Bangun Layout Structure & routing aplikasi
    - Implementasikan kerangka layout (top app bar + sidebar + content area) dan konfigurasi routing antar modul (Dashboard, Promo Management, Master Data, Reports, Settings)
    - _Requirements: (fondasi navigasi seluruh modul)_

  - [x] 2.3 Bangun Sidebar Navigation (role-aware scaffold)
    - Implementasikan item sidebar (Dashboard, Promo Management: Campaigns/Promo Scenarios/Promo Execution, Master Data: Product Master/Cost Configuration/Promo Templates, Reports: Campaign History/Promo History/Approval History, Settings: Brand Management)
    - Sembunyikan modul konfigurasi untuk Admin_Marketplace (antarmuka tersederhanakan); SPV_Marketing melihat antarmuka penuh
    - _Requirements: 1.2, 1.3, 1.6_

  - [x] 2.4 Bangun Top Navigation bar
    - Implementasikan top app bar berisi identitas pengguna, peran, dan container Global Brand Selector yang konsisten di seluruh halaman
    - _Requirements: 1.1_

  - [x] 2.5 Implementasikan Global Brand Selector + konteks Brand aktif (state sesi)
    - Implementasikan dropdown Brand pada top app bar dan state konteks Brand aktif (sticky per sesi) yang menjadi sumber filter lintas modul
    - Sediakan mekanisme recompute view saat Brand diganti; konteks ini akan dikonsumsi oleh Dashboard, Product Master, Approved Promos, dan Reports pada fase fitur
    - _Requirements: 2.5, 3.15, 13.3, 15.2_

  - [x] 2.6 Bangun komponen Empty State reusable (UX)
    - Implementasikan komponen Empty State reusable dengan varian: **No Campaigns**, **No Promos**, **No Products**, dan **No Search Results**; setiap varian menampilkan pesan kontekstual dan **call-to-action** yang mengarahkan pengguna ke aksi berikutnya (mis. "Buat Campaign", "Tambah Produk", "Reset Filter")
    - Komponen ini diterapkan per modul pada fase fitur (Product Master, Campaign History, Promo History) untuk listing kosong dan hasil pencarian kosong
    - _Requirements: 3.14, 3.15, 15.1, 16.1, 16.6_

  - [x] 2.7 Bangun komponen Loading State reusable (UX)
    - Implementasikan komponen Loading State reusable (skeleton untuk tabel/kartu dan spinner untuk aksi) yang konsisten lintas modul
    - Komponen ini diterapkan per modul pada fase fitur — minimal pada **Dashboard**, **Product Master**, dan **Promo History** — saat data sedang dimuat
    - _Requirements: (fondasi UX seluruh modul; diterapkan pada Dashboard Req 2.1, Product Master Req 3.14/3.15, Promo History Req 16.1)_

  - [x] 2.8 Tulis unit test App Shell, Global Brand Selector & state reusable
    - Uji propagasi konteks Brand aktif (sticky per sesi), visibilitas sidebar berbasis peran, serta rendering varian Empty State (No Campaigns/No Promos/No Products/No Search Results) dan Loading State
    - _Requirements: 1.2, 1.3, 2.5, 3.15, 16.6_

- [x] 3. Authentication Flow & Session Management
  - [x] 3.1 Implementasikan Authentication Flow
    - Bangun alur login dan asosiasikan setiap akun pengguna ke tepat satu peran (SPV_Marketing atau Admin_Marketplace)
    - _Requirements: 1.1_

  - [x] 3.2 Implementasikan Session Management & route guards
    - Kelola state sesi pengguna (peran aktif + Brand aktif sticky per sesi); terapkan route guard berbasis peran yang menolak akses UI ke modul konfigurasi bagi Admin_Marketplace (lapisan kenyamanan; penegak utama tetap di API)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 3.3 Tulis unit test Authentication & Session
    - Uji asosiasi tepat satu peran per akun dan penolakan rute konfigurasi bagi Admin_Marketplace
    - _Requirements: 1.1, 1.6_

### MVP v1 — Core Operational Workflow

- [x] 4. Otentikasi dan Kontrol Akses Berbasis Peran (RBAC)
  - [x] 4.1 Implementasikan AccessController.authorize
    - Tulis `authorize(user, action, resourceType)` → Allow | Deny(message)
    - SPV_Marketing: izinkan seluruh aksi tulis pada 5 resource (all-or-nothing); Admin_Marketplace: tolak tulis pada 5 resource, izinkan read promo Approved + create Feedback_Record
    - Petakan akun ke tepat satu peran
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 4.2 Tulis unit test RBAC dan assignment peran
    - Uji penegakan all-or-nothing SPV dan penolakan tulis Admin (contoh + edge)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 5. Brand Management (Brand Context)
  - [x] 5.1 Implementasikan BrandService (domain + persistence)
    - `create` (validasi keunikan Brand ID, isi audit fields), `update` (simpan hanya bila seluruh validasi/constraint lolos), `delete` (hanya bila tidak ada Product/Campaign/Promo terkait; jika ada → tolak), `archive` (tandai arsip tanpa hapus)
    - Tegakkan invarian kepemilikan tepat satu Brand pada entitas turunan
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 23.2_

  - [x] 5.2 Implementasikan endpoint API Brand + RBAC
    - Endpoint create/update/archive/delete dengan penegakan RBAC dan mapping error domain → HTTP
    - _Requirements: 1.2, 1.6, 19.1, 19.3, 19.5, 19.6_

  - [x] 5.3 Bangun UI Settings → Brand Management
    - Halaman daftar Brand dengan aksi create/edit/archive/delete (proteksi referensi), di grup Settings sesuai navigasi
    - _Requirements: 19.1, 19.3, 19.5, 19.6, 19.7, 19.9_

  - [x] 5.4 Tulis unit/example test Brand Management
    - Uji keunikan Brand ID duplikat, gating validasi edit, proteksi delete vs archive
    - _Requirements: 19.2, 19.4, 19.6_

- [x] 6. Product Master
  - [x] 6.1 Implementasikan ProductService.create dan validasi keunikan
    - Tegakkan keunikan pada kombinasi `(brandId, productId)`; warning bila Product ID dipakai di Brand lain namun tetap simpan; validasi Brand ada; Nama Produk tanpa batasan keunikan; isi audit fields
    - Batasi Status pada Active/Inactive/Archived
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.16, 23.2_

  - [x] 6.2 Implementasikan edit, archive, dan delete dengan proteksi referensi
    - `update` (perbarui field + Updated At), `archive` (tandai Archived tanpa hapus), `delete` hanya bila tidak direferensikan promo; jika direferensikan → tolak & arahkan ke Archive
    - _Requirements: 3.8, 3.9, 3.10, 3.11, 3.16, 23.3, 23.4_

  - [x] 6.3 Implementasikan import Excel/CSV produk (inti parsing & partisi)
    - Parse berkas; buat satu entri per baris valid; kumpulkan baris gagal/invalid ke daftar gagal (jumlah berhasil + gagal == total baris)
    - _Requirements: 3.12, 3.13_

  - [x] 6.4 Implementasikan Download Template impor produk
    - Sediakan unduhan template Excel/CSV berisi header kolom produk yang benar (Product ID, Nama Produk, Kategori, HPP, Harga Jual, Status, Brand) agar pengguna mengisi data dalam format yang dapat diimpor
    - _Requirements: 3.12_

  - [x] 6.5 Implementasikan Import Validation Feedback (per baris)
    - Hasilkan umpan balik validasi per baris (nomor baris, field bermasalah, dan alasan kegagalan) untuk setiap baris yang gagal diimpor, tanpa membatalkan baris valid lainnya
    - _Requirements: 3.13_

  - [x] 6.6 Implementasikan Import Summary (ringkasan hasil)
    - Hasilkan ringkasan impor: jumlah baris berhasil, jumlah baris gagal, dan total baris (berhasil + gagal == total) untuk ditampilkan setelah impor selesai
    - _Requirements: 3.12, 3.13_

  - [x] 6.7 Implementasikan pencarian produk (substring + cakupan Brand)
    - Cocokkan substring pada Nama Produk atau Product ID; dukung filter Brand pada listing
    - _Requirements: 3.14, 3.15_

  - [x] 6.8 Implementasikan endpoint API Product Master + RBAC
    - Endpoint CRUD/import (template/validation/summary)/search dengan penegakan RBAC
    - _Requirements: 1.2, 1.6, 3.1, 3.8, 3.12, 3.14_

  - [x] 6.9 Bangun UI Product Master (+ Empty State & Loading State)
    - Listing dengan kolom Brand tetap tampil meski Global Brand Selector aktif; aksi Add/Edit/Archive (tanpa permanent delete di workflow utama); Import Excel/CSV dengan tombol Download Template, panel Import Validation Feedback per baris, dan Import Summary; search; integrasi Global Brand Selector
    - Terapkan komponen Empty State reusable (varian **No Products** untuk listing kosong dan **No Search Results** untuk pencarian tanpa hasil) dan Loading State saat data dimuat
    - _Requirements: 3.12, 3.13, 3.14, 3.15, 3.17_

  - [x]* 6.10 Tulis unit/example test Product Master
    - Uji duplikat per Brand, Product ID sama lintas Brand diizinkan, Nama Produk duplikat diizinkan, proteksi delete→archive, partisi import, isi Import Summary (berhasil/gagal/total), dan umpan balik validasi per baris
    - _Requirements: 3.2, 3.3, 3.5, 3.10, 3.12, 3.13_

- [x] 7. Cost Configuration (per Brand)
  - [x] 7.1 Implementasikan CostConfigService
    - `get(brandId)` mengembalikan 10 komponen persen; `update(brandId, components)` validasi setiap komponen dalam 0–100 dan tolak seluruh perubahan secara atomik bila ada yang di luar rentang; isolasi antar Brand; tandai konfigurasi aktif
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 7.2 Implementasikan endpoint API Cost Configuration + RBAC
    - Endpoint get/update per Brand dengan penegakan RBAC
    - _Requirements: 1.2, 1.6, 4.1, 4.3_

  - [x] 7.3 Bangun UI Cost Configuration
    - Form 10 komponen biaya per Brand mengikuti konteks Global Brand Selector
    - _Requirements: 4.1, 4.3, 4.5_

  - [x]* 7.4 Tulis unit/example test Cost Configuration
    - Uji atomicitas penolakan di luar 0–100 dan isolasi antar Brand
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 8. Campaign Management
  - [x] 8.1 Implementasikan CampaignService inti
    - `create` (Status awal Draft, validasi Tanggal Selesai ≥ Mulai, Brand wajib & ada, audit fields), `update` (validasi sama, perbarui Updated At), `archive`, `delete` hanya bila tanpa Promo terkait; bedakan error sistem dari error validasi input
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.13, 6.14, 23.2, 23.3_

  - [x] 8.2 Implementasikan CampaignService.createInline
    - Buat Campaign di tengah alur pembuatan Promo (Brand ter-default = Brand promo); terapkan seluruh validasi Campaign; tolak bila Brand campaign ≠ Brand promo
    - _Requirements: 7.12, 7.13, 7.14_

  - [x] 8.3 Implementasikan endpoint API Campaign + RBAC
    - Endpoint create/update/archive/delete + createInline dengan RBAC
    - _Requirements: 1.2, 1.6, 6.1, 6.5, 6.7_

  - [x] 8.4 Bangun UI Campaigns list dan Campaign Detail page (+ Empty State)
    - Daftar Campaign (aksi View/Edit/Archive); Campaign Detail sebagai container daftar Promo (A/B/C) dengan tombol "+ Add Promo to this Campaign" (Brand & Campaign ter-default)
    - Terapkan komponen Empty State reusable (varian **No Campaigns** untuk daftar campaign kosong dan **No Promos** untuk Campaign Detail tanpa promo) dengan call-to-action yang relevan
    - _Requirements: 6.10, 6.11, 15.1_

  - [x]* 8.5 Tulis unit/example test Campaign Management
    - Uji validasi tanggal, validasi Brand, proteksi delete→archive, pembedaan error sistem vs validasi
    - _Requirements: 6.2, 6.3, 6.8, 6.14_

- [x] 9. Promo Scenario - Basic Information
  - [x] 9.1 Implementasikan PromoService.create
    - Status awal Draft; wajib terkait tepat satu Campaign yang ada; Brand promo == Brand Campaign; validasi tanggal, Brand, Promo_Type; isi audit fields
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.11, 6.10, 6.11, 6.12, 23.2_

  - [x] 9.2 Implementasikan PromoService.createWithInlineCampaign
    - Delegasikan pembuatan campaign ke `CampaignService.createInline` (Brand ter-default = Brand promo), lalu kaitkan promo; tegakkan konsistensi Brand & seluruh validasi Campaign
    - _Requirements: 7.12, 7.13, 7.14_

  - [x] 9.3 Implementasikan edit Basic Information
    - Simpan perubahan valid; tolak keadaan tidak valid (tanggal) dan pertahankan data sebelumnya; perbarui Updated At
    - _Requirements: 7.9, 7.10, 7.11, 23.3, 23.4_

  - [x] 9.4 Implementasikan endpoint API Promo Scenario + RBAC
    - Endpoint create/createWithInlineCampaign/update dengan RBAC
    - _Requirements: 1.2, 1.6, 7.1, 7.9, 7.12_

  - [x] 9.5 Bangun UI Promo Scenario - Basic Information
    - Form Promo Name, Campaign (dengan opsi "+ Create new campaign inline"), Promo Type, Date Range; tombol Save Draft permanen + Submit; default Brand dari Global Brand Selector
    - _Requirements: 7.1, 7.12, 7.13, 7.14_

  - [x]* 9.6 Tulis unit/example test Promo Basic Information
    - Uji konsistensi Brand promo==campaign, validasi tanggal/Promo_Type, alur inline campaign
    - _Requirements: 7.3, 7.4, 7.7, 7.14_

- [x] 10. Dynamic Rule Builder
  - [x] 10.1 Implementasikan RuleBuilder (add/remove)
    - `addRule` (minimum quantity ≥ 1, benefit diskon% atau free gift), jumlah Rule tak terbatas; `removeRule`; tolak min qty < 1
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.2 Implementasikan RuleSelector.select
    - Pilih Rule dengan minimum quantity terpenuhi tertinggi (≤ quantity); bila tidak ada → tidak ada Rule diterapkan
    - _Requirements: 8.5_

  - [x] 10.3 Bangun UI Rules section pada Promo Scenario
    - Tabel Minimum Qty → Benefit dengan tambah/hapus Rule
    - _Requirements: 8.1, 8.2, 8.4_

  - [x]* 10.4 Tulis unit/example test Rule Builder & Selector
    - Uji penolakan min qty < 1 dan pemilihan Rule tertinggi terpenuhi
    - _Requirements: 8.3, 8.5_

- [x] 11. Product Selection
  - [x] 11.1 Implementasikan ProductSelection (domain)
    - Tarik Product ID/Nama/HPP/Harga Jual dari Product_Master via identitas `(brandId, productId)`; multi-select; bulk paste mempartisi added/skipped-brand-lain/unmatched tanpa membatalkan operasi; skip duplikat; batasi produk Brand promo & Status Active untuk promo baru; pertahankan referensi historis Inactive/Archived; tolak produk Brand lain
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14_

  - [x] 11.2 Implementasikan API + pencarian produk dalam pemilihan promo
    - Endpoint selection/bulk-add; pencarian dibatasi produk Brand promo
    - _Requirements: 1.2, 1.6, 9.5, 9.6_

  - [x] 11.3 Bangun UI Product Selection
    - Search, multi-select, Bulk Paste IDs; tampilan Selected; laporan unmatched/skipped
    - _Requirements: 9.5, 9.6, 9.7, 9.8_

  - [x]* 11.4 Tulis unit/example test Product Selection
    - Uji partisi bulk paste, skip duplikat, batasan Brand+Status, referensi historis
    - _Requirements: 9.3, 9.6, 9.8, 9.11, 9.13, 9.14_

- [x] 12. Promo Clone (aksi first-class frekuensi tinggi, mandatory MVP v1)
  - [x] 12.1 Implementasikan PromoCloneService.clone (domain + persistence)
    - Salin Promo_Type, Rules, dan Product List dari promo sumber; referensikan produk via identitas `(brandId, productId)` konsisten dengan Brand hasil klona (tidak pernah Nama Produk)
    - Promo hasil klona dimulai dengan Status Draft; isi field audit baru (Created By = pengguna yang melakukan klona, Created At = waktu kini)
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 12.2 Implementasikan endpoint API Promo Clone + RBAC
    - Endpoint clone(promoId) dengan penegakan RBAC (SPV only); mapping error domain → HTTP
    - _Requirements: 1.2, 1.6, 24.1_

  - [x] 12.3 Bangun UI aksi baris Clone
    - Tambahkan aksi baris first-class Clone pada Promo Scenarios list dan Campaign Detail (berdampingan View/Edit/Archive); arahkan ke Draft hasil klona untuk penyesuaian (aksi Clone pada Promo History dibangun pada Task 18.3 saat halaman tersebut tersedia)
    - _Requirements: 24.1, 24.2_

  - [x]* 12.4 Tulis unit/example test Promo Clone
    - Uji fidelitas penyalinan (Promo_Type, Rules, Product List via identitas Brand+Product ID), Status awal Draft, dan field audit baru
    - **Property 43: Fidelitas Promo Clone**
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4**

- [x] 13. Promo Logic & Promo Simulator (+ Margin Health)
  - [x] 13.1 Implementasikan PromoCalculator (pure)
    - `pricePerPcs = hargaJual - (hargaJual * discountPct)`; `total = pricePerPcs * qty`; terapkan Rule sama ke seluruh produk terpilih
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 13.2 Implementasikan Simulator.simulate (pure)
    - Hasilkan 7 keluaran (Harga Normal, Harga Promo, Potongan=Normal−Promo, Margin Rp=Promo−HPP, Margin %, NPM Rp, NPM %); NPM memakai HPP + 10 komponen Cost_Configuration aktif Brand promo; margin negatif tidak di-clamp; tunda NPM bila Cost_Configuration tidak aktif; recompute real-time
    - _Requirements: 10.1, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 4.4_

  - [x] 13.3 Implementasikan Simulator.activeCostConfigInfo
    - Kembalikan { brandId, isActive, lastUpdatedDate } untuk ditampilkan transparan pada Simulator
    - _Requirements: 11.8_

  - [x] 13.4 Implementasikan MarginHealth.classify (pure)
    - Healthy (NPM ≥ 20), Warning (10 ≤ NPM < 20), Risky (NPM < 10); batas: tepat 10 → Warning, tepat 20 → Healthy; analitis semata, tidak memengaruhi approval; recompute saat NPM berubah
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 13.5 Bangun UI Promo Simulator inline
    - Tampilkan Active Cost Configuration + Last Updated Date; Summary View (Total/Healthy/Warning/Risky) sebagai fokus; Detailed View per produk (7 keluaran) yang dapat di-expand/collapse
    - _Requirements: 11.1, 11.8, 20.1_

  - [x]* 13.6 Tulis unit/example test Promo Logic & Simulator
    - Uji aritmetika harga/margin (termasuk margin negatif), NPM dengan 10 komponen, penundaan NPM, batas klasifikasi Margin_Health (10 & 20)
    - _Requirements: 10.1, 11.4, 11.5, 11.7, 20.1_

- [x] 14. Approval Workflow
  - [x] 14.1 Implementasikan ApprovalService.changeStatus
    - Transisi Draft/Review/Approved/Rejected; tulis Approval_History dalam transaksi tunggal; rollback status bila penulisan history gagal (tepat satu catatan per perubahan)
    - _Requirements: 12.1, 12.5, 17.2, 17.3_

  - [x] 14.2 Implementasikan endpoint API Approval + RBAC
    - Endpoint perubahan status dengan RBAC (SPV only)
    - _Requirements: 1.2, 1.6, 12.1_

  - [x] 14.3 Bangun UI perubahan status approval
    - Aksi Submit for Review / Approve / Reject pada Promo Scenario
    - _Requirements: 12.1, 12.2_

  - [x]* 14.4 Tulis unit/integration test Approval Workflow
    - Uji penambahan tepat satu catatan history per perubahan dan rollback atomik saat penulisan history gagal
    - _Requirements: 12.5, 17.2, 17.3_

- [x] 15. Promo Execution (Approved Promos + Admin Board + Execution Status)
  - [x] 15.1 Implementasikan AdminExecutionBoard.list
    - Tampilkan hanya promo Approved beserta Campaign/Promo/Products; prioritaskan pesan error sistem bila gagal ambil data; sembunyikan promo Approved selain Approved; izinkan sembunyikan promo Approved rusak untuk jaga tata letak
    - _Requirements: 12.2, 12.3, 12.4, 12.6, 14.1, 14.2, 14.3_

  - [x] 15.2 Implementasikan ExecutionStatusService.update
    - Batasi nilai pada Approved/Sent to Admin/Marketplace Setup/Completed; simpan nilai baru; rollback & pertahankan nilai sebelumnya bila gagal
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 15.3 Implementasikan Approved Promos listing + filter Brand
    - Tampilkan seluruh promo Approved (termasuk produk nol) dengan Nama Promo, Brand, Campaign, Jumlah Produk, Tanggal Approve, Status Eksekusi; filter Brand
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 15.4 Implementasikan endpoint API Execution + RBAC
    - Endpoint list board + update execution status dengan RBAC (Admin dapat update status & read Approved)
    - _Requirements: 1.3, 1.6, 14.1, 18.2, 18.3_

  - [x] 15.5 Bangun UI Admin Marketplace (simplified) + Execution
    - Antarmuka tersederhanakan Admin: daftar promo Approved butuh aksi, dropdown Execution Status, buka detail promo; sembunyikan modul konfigurasi
    - _Requirements: 1.3, 14.1, 18.2_

  - [x]* 15.6 Tulis unit/example test Promo Execution
    - Uji visibilitas Approved-only, prioritas pesan error sistem, atomicitas update execution status
    - _Requirements: 12.3, 12.6, 14.3, 18.4_

- [x] 16. Dashboard (actionable-first + Work Queue)
  - [x] 16.1 Implementasikan DashboardService widgets + Work Queue (domain)
    - Hitung widget actionable-first (Promo Pending Review, Waiting for Execution, Active, Completed) dan metrik historis sekunder (Total Campaign, Total Promo, Draft/Review/Approved/Rejected) dari data terkini
    - Hitung Work Queue (Pending Reviews, Rejected Promos, Unread Feedback, Waiting for Execution); seluruh widget & Work Queue mengikuti filter Brand; selesaikan pending recompute saat pemuatan Dashboard
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_

  - [x] 16.2 Implementasikan Recent Activity
    - Kembalikan item terbaru (top-N berdasarkan recency) untuk campaign, promo, dan approval; hormati filter Brand
    - _Requirements: 2.3, 2.5_

  - [x] 16.3 Implementasikan endpoint API Dashboard + RBAC
    - Endpoint ringkasan dashboard (widgets, Work Queue, Recent Activity) dengan RBAC dan parameter Brand aktif
    - _Requirements: 1.2, 2.1, 2.5_

  - [x] 16.4 Bangun UI Dashboard + integrasi Global Brand Selector (+ Loading State)
    - Tata letak actionable-first (Perlu Aksi), Work Queue personal, Ringkasan Historis sekunder, Recent Campaigns/Promos; konsumsi Global Brand Selector (sticky per sesi) dari Sprint 0 untuk memfilter seluruh widget & Recent Activity
    - Terapkan komponen Loading State reusable (skeleton widget & Recent Activity) saat data dashboard dimuat
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 2.7_

  - [x]* 16.5 Tulis unit/example test Dashboard
    - Uji kesamaan widget dengan hitungan sebenarnya (termasuk setelah mutasi & pending recompute), filter Brand, Recent Activity recency, dan keempat indikator Work Queue
    - **Property 3: Widget Dashboard sama dengan hitungan sebenarnya (termasuk filter Brand)**
    - **Property 4: Recent Activity adalah item terbaru berdasarkan waktu**
    - **Property 45: Korektnes indikator Work Queue Dashboard (dengan filter Brand)**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 17. Checkpoint MVP v1 - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

### MVP v1.1 — Productivity & Historical Features

- [x] 18. Promo History (+ pencarian/filter lintas campaign)
  - [x] 18.1 Implementasikan PromoHistory.list & search/resetFilters (domain)
    - `list()` mengembalikan seluruh Promo_Scenario historis lintas campaign dengan Jumlah Produk benar
    - `search({ keyword, brand, campaign, promoType, status, dateRange })` mencocokkan kata kunci pada Nama Promo; kombinasikan filter Brand/Campaign/Promo Type/Status/Date Range secara **AND**; Date Range **inklusif** pada batas awal & akhir (berdasarkan Tanggal Dibuat); kembalikan daftar kosong + pesan tidak ada hasil bila tak ada yang cocok
    - `resetFilters()` mengembalikan seluruh Promo_Scenario historis lintas campaign
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [x] 18.2 Implementasikan endpoint API Promo History + RBAC
    - Endpoint list/search/reset dengan RBAC; mengikuti konteks Global Brand Selector
    - _Requirements: 1.2, 16.1, 16.3_

  - [x] 18.3 Bangun UI Promo History (+ aksi Clone & Empty State)
    - Halaman daftar promo historis dengan search kata kunci + kombinasi filter (Brand/Campaign/Promo Type/Status/Date Range) dan tombol Reset Filters; aksi baris first-class View/Edit/Clone/Archive (Clone memakai PromoCloneService dari Task 12)
    - Terapkan komponen Empty State reusable (varian **No Search Results** untuk pencarian/kombinasi filter tanpa hasil, dan **No Promos** untuk riwayat kosong) dan Loading State saat data dimuat
    - _Requirements: 16.1, 16.3, 16.6, 16.7, 24.1_

  - [x]* 18.4 Tulis unit/example test Promo History
    - Uji kelengkapan listing (Jumlah Produk), kombinasi filter AND, Date Range inklusif, pencarian kata kunci, pesan kosong, dan reset
    - **Property 32: Kelengkapan dan konten listing**
    - **Property 33: Korektnes filter Promo History (multi-kriteria, kombinasi AND)**
    - **Property 44: Korektnes pencarian Promo History (kata kunci, Date Range inklusif, empty, reset)**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7**

- [x] 19. Checkpoint MVP v1.1 - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

### MVP v1.2 — Secondary Management Features

- [x] 20. Feedback Thread (utas dua arah lintas peran)
  - [x] 20.1 Implementasikan FeedbackService.add (domain + persistence)
    - `add(promo, user, message)` membuat Feedback_Record terstruktur (Feedback Message, Created By User, Created Date, Promo Reference); izinkan banyak record per Promo_Scenario; pertahankan tiap record sebagai catatan terpisah dengan field utuh
    - Izinkan pembuatan oleh setiap peran yang memiliki akses ke promo (SPV_Marketing maupun Admin_Marketplace) sebagai utas diskusi dua arah
    - `list(promo)` mengembalikan seluruh Feedback_Record beserta Created By User dan Created Date untuk tiap catatan
    - _Requirements: 1.4, 1.5, 14.4, 14.5, 14.6_

  - [x] 20.2 Implementasikan endpoint API Feedback + RBAC
    - Endpoint create/list Feedback_Record; izinkan create untuk SPV_Marketing dan Admin_Marketplace yang memiliki akses ke promo Approved bersangkutan; mapping error domain → HTTP
    - _Requirements: 1.4, 1.5, 14.4_

  - [x] 20.3 Bangun UI utas Feedback pada detail Promo
    - Tampilkan utas Feedback_Record terurut beserta Created By User & Created Date tiap catatan; form tambah feedback yang tampil untuk kedua peran (utas dua arah)
    - _Requirements: 14.5, 14.6_

  - [x]* 20.4 Tulis unit/example test Feedback Thread
    - Uji pembuatan feedback oleh tiap peran berakses, multiplisitas banyak record per promo, dan kelengkapan field (Message/Created By/Created Date/Promo Reference)
    - **Property 2: Feedback dapat dibuat oleh setiap peran yang punya akses**
    - **Property 31: Feedback_Record round-trip dan multiplisitas**
    - **Validates: Requirements 1.4, 1.5, 14.4, 14.5, 14.6**

- [x] 21. Approval History (halaman/listing - governance/audit)
  - [x] 21.1 Implementasikan ApprovalHistory.list (domain/service)
    - Kembalikan setiap catatan approval menampilkan Nama Promo, Campaign, Tanggal Approval, dan Status Approval (catatan ditulis oleh ApprovalService.changeStatus pada Task 14.1)
    - _Requirements: 17.1_

  - [x] 21.2 Implementasikan endpoint API Approval History + RBAC
    - Endpoint list dengan RBAC; mengikuti konteks Global Brand Selector
    - _Requirements: 1.2, 17.1_

  - [x] 21.3 Bangun UI Approval History
    - Tabel riwayat approval (Nama Promo, Campaign, Tanggal Approval, Status Approval)
    - _Requirements: 17.1_

  - [x]* 21.4 Tulis unit/example test Approval History
    - Uji kelengkapan listing dan akumulasi catatan per perubahan status
    - **Property 32: Kelengkapan dan konten listing**
    - **Property 34: Setiap perubahan status menambah tepat satu catatan Approval History**
    - **Validates: Requirements 17.1**

- [x] 22. Promo Templates
  - [x] 22.1 Implementasikan PromoTemplateService (seeded + CRUD)
    - Sediakan template bawaan (Buy X Discount Y%, Buy X Get Free Gift, Voucher Discount, Flash Sale, Bundle Promo); `create`/`update`/`delete` dengan jumlah tak terbatas; pertahankan data tanpa kehilangan saat error validasi/sistem
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 22.2 Implementasikan endpoint API Promo Templates + RBAC
    - Endpoint CRUD template dengan RBAC; mapping error domain → HTTP
    - _Requirements: 1.2, 1.6, 5.2, 5.4, 5.5_

  - [x] 22.3 Bangun UI Master Data → Promo Templates
    - Listing template bawaan + buatan; aksi create/edit/delete; pesan error spesifik tanpa kehilangan data
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_

  - [x]* 22.4 Tulis unit/example test Promo Templates
    - Uji keberadaan 5 template bawaan dan operasi daftar template (add/update/delete tak terbatas)
    - **Property 14: Operasi daftar (template, rule, produk promo, attachment) mencerminkan add/remove**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 23. Campaign History & Additional Reporting (reporting sekunder)
  - [x] 23.1 Implementasikan CampaignHistory.list (domain)
    - Tampilkan seluruh campaign termasuk yang berjumlah promo nol dengan Jumlah Promo benar; dukung filter Brand/Status/Tanggal
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 23.2 Implementasikan endpoint API Campaign History + RBAC
    - Endpoint list/filter dengan RBAC; mengikuti konteks Global Brand Selector
    - _Requirements: 1.2, 15.1, 15.2_

  - [x] 23.3 Bangun UI Reports → Campaign History (+ Empty State)
    - Tabel campaign (termasuk Jumlah Promo nol) dengan filter Brand/Status/Tanggal mengikuti Global Brand Selector
    - Terapkan komponen Empty State reusable (varian **No Campaigns** untuk hasil filter kosong) dengan call-to-action yang relevan
    - _Requirements: 15.1, 15.2, 15.3_

  - [x]* 23.4 Tulis unit/example test Campaign History
    - Uji kelengkapan listing (termasuk campaign berjumlah promo nol) dan korektnes filter Brand
    - **Property 11: Filter Brand pada listing hanya menampilkan Brand terpilih**
    - **Property 32: Kelengkapan dan konten listing**
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 24. Attachments & tampilan gabungan Promo Execution (nice-to-have, feature-flagged)
  - [x]* 24.1 Implementasikan Attachments pada Promo_Scenario (nice-to-have)
    - Upload/list/remove Attachment (Attachment Name, File URL, Uploaded By, Upload Date); tampilkan seluruh Attachment beserta Name/Uploaded By/Upload Date saat membuka promo; di belakang feature flag
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x]* 24.2 Implementasikan tampilan gabungan Promo Execution (nice-to-have)
    - WHERE feature flag aktif, sajikan tampilan gabungan promo Approved + Execution_Status (Approved/Sent to Admin/Marketplace Setup/Completed) dengan mempertahankan kapabilitas Approved_Promos (Req 13) & Execution_Status (Req 18) sebagai sumber
    - _Requirements: 22.1, 22.2, 22.3_

  - [x]* 24.3 Tulis unit/example test Attachments & tampilan gabungan
    - Uji operasi daftar attachment (add/remove tak terbatas, skip duplikat) dan kesetaraan tampilan gabungan Promo Execution dengan sumbernya
    - **Property 14: Operasi daftar (template, rule, produk promo, attachment) mencerminkan add/remove**
    - **Property 41: Tampilan gabungan Promo Execution setara sumbernya**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 22.1, 22.2, 22.3**

- [x] 25. Checkpoint MVP v1.2 - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

### Deployment Readiness (berbasis kode/konfigurasi)

> Fase ini HANYA berisi aktivitas yang dapat diwujudkan sebagai kode/konfigurasi (file env + config loader, skrip migrasi, skrip backup/restore). Aktivitas operasional non-coding (provisioning manual, prosedur ops) sengaja TIDAK dimasukkan sebagai task. Tempatkan sebagai prasyarat rilis setelah fase fitur.

- [x] 26. Deployment Readiness (Environment, Migration, Backup)
  - [x] 26.1 Implementasikan Environment Configuration
    - Buat berkas konfigurasi environment untuk development/staging/production (mis. `.env.development`, `.env.staging`, `.env.production` + `.env.example`) dan sebuah config loader tervalidasi yang membaca variabel (koneksi basis data, feature flags, parameter aplikasi) serta gagal cepat (fail-fast) bila variabel wajib hilang/invalid
    - _Requirements: (fondasi konfigurasi rilis lintas modul)_

  - [x] 26.2 Implementasikan Database Migration Strategy
    - Buat perkakas/skrip migrasi basis data (migrasi berversi dengan up/down) yang mengkodekan skema entitas (Brand, Product, Campaign, Promo_Scenario, Cost_Configuration, Promo_Template, Feedback_Record, Approval_History, Execution_Status) dan menegakkan integritas relasional sesuai model persistence
    - _Requirements: (fondasi persistence & integritas data; mendukung Req 19.8, 17.3, 18.4)_

  - [x] 26.3 Implementasikan Backup Strategy
    - Buat skrip backup dan restore otomatis (mis. dump/restore basis data yang dapat dijadwalkan) beserta verifikasi hasil backup, untuk menjaga keberlangsungan data historis promo/campaign
    - _Requirements: (fondasi keberlangsungan & integritas data historis)_

  - [x]* 26.4 Tulis unit/integration test Deployment Readiness
    - Uji config loader (fail-fast saat variabel wajib hilang, parsing nilai per environment), idempotensi/urutan migrasi (up lalu down memulihkan skema), serta round-trip skrip backup→restore
    - _Requirements: (fondasi konfigurasi & persistence)_

- [x] 27. Checkpoint Deployment Readiness - Pastikan seluruh test lolos
  - Ensure all tests pass, ask the user if questions arise.

### Property-Based Testing menyeluruh (bertahap/opsional, non-blocking)

> Catatan: seluruh task pada bagian ini bersifat **opsional/bertahap** dan **BUKAN blocker rilis MVP**. Properti 1–45 dipertahankan utuh sebagai referensi korektnes dan traceability. Implementasi penuh dapat dikerjakan progresif setelah fase fitur. Untuk MVP, validasi cukup melalui Unit/Integration/Business Validation Tests (sub-task `*` dekat implementasi pada Tasks 1–26).

- [x] 28. Property-Based Testing — logika domain murni (bertahap/opsional)
  - Catatan: gunakan fast-check, minimum 100 iterasi per test, dan tag komentar `Feature: promotion-management-system, Property {n}: {teks properti}`. JANGAN mengimplementasikan PBT dari nol.

  - [x]* 28.1 PBT keunikan produk
    - **Property 5: Keunikan produk hanya pada (Brand + Product ID)**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [x]* 28.2 PBT operasi daftar add/remove
    - **Property 14: Operasi daftar (template, rule, produk promo, attachment) mencerminkan add/remove**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.4, 9.2, 9.3, 9.4, 9.7, 9.9, 21.1, 21.2, 21.3**

  - [x]* 28.3 PBT pemilihan Rule
    - **Property 20: Pemilihan Rule memakai minimum quantity terpenuhi tertinggi**
    - **Validates: Requirements 8.5**

  - [x]* 28.4 PBT field produk promo via identitas
    - **Property 22: Field produk pada promo bersumber dari Product_Master melalui identitas (Brand + Product ID)**
    - **Validates: Requirements 9.1, 9.10**

  - [x]* 28.5 PBT partisi penambahan massal Product ID
    - **Property 23: Penambahan massal Product ID mempartisi menjadi added / skipped-brand-lain / unmatched**
    - **Validates: Requirements 9.6, 9.8, 9.9**

  - [x]* 28.6 PBT cakupan Brand & Status pemilihan produk
    - **Property 24: Cakupan Brand dan Status pada pemilihan produk**
    - **Validates: Requirements 9.11, 9.12, 9.13, 9.14**

  - [x]* 28.7 PBT aritmetika Promo Logic & Simulator
    - **Property 25: Aritmetika Promo Logic dan Simulator**
    - **Validates: Requirements 10.1, 10.2, 11.4, 11.6**

  - [x]* 28.8 PBT Rule sama untuk seluruh produk
    - **Property 26: Rule yang sama diterapkan ke seluruh produk terpilih**
    - **Validates: Requirements 10.3**

  - [x]* 28.9 PBT kelengkapan keluaran Simulator
    - **Property 27: Kelengkapan dan konsistensi keluaran Simulator**
    - **Validates: Requirements 11.1, 11.2, 11.3, 4.4**

  - [x]* 28.10 PBT NPM iff Cost_Configuration aktif
    - **Property 28: NPM dihitung jika dan hanya jika Cost_Configuration aktif tersedia**
    - **Validates: Requirements 11.7**

  - [x]* 28.11 PBT klasifikasi Margin_Health & non-interferensi
    - **Property 40: Klasifikasi Margin_Health (Profitability Indicator) dari NPM% (dengan batas) dan non-interferensi**
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4**

  - [x]* 28.12 PBT fidelitas Promo Clone
    - **Property 43: Fidelitas Promo Clone**
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4**

  - [x]* 28.13 PBT pencarian Promo History
    - **Property 44: Korektnes pencarian Promo History (kata kunci, Date Range inklusif, empty, reset)**
    - **Validates: Requirements 16.2, 16.5, 16.6, 16.7**

- [x] 29. Property-Based Testing — services, persistence, RBAC & dashboard (bertahap/opsional)
  - Catatan: gunakan fast-check, minimum 100 iterasi per test, dan tag komentar `Feature: promotion-management-system, Property {n}: {teks properti}`.

  - [x]* 29.1 PBT RBAC
    - **Property 1: RBAC SPV write-all, Admin read-Approved-only**
    - **Validates: Requirements 1.2, 1.3, 1.6**

  - [x]* 29.2 PBT feedback lintas peran
    - **Property 2: Feedback dapat dibuat oleh setiap peran yang punya akses**
    - **Validates: Requirements 1.4, 1.5**

  - [x]* 29.3 PBT widget Dashboard
    - **Property 3: Widget Dashboard sama dengan hitungan sebenarnya (termasuk filter Brand)**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**

  - [x]* 29.4 PBT Recent Activity
    - **Property 4: Recent Activity adalah item terbaru berdasarkan waktu**
    - **Validates: Requirements 2.3**

  - [x]* 29.5 PBT round-trip produk
    - **Property 6: Round-trip persistensi & penyuntingan produk**
    - **Validates: Requirements 3.1, 3.8**

  - [x]* 29.6 PBT validasi Brand entitas
    - **Property 7: Validasi Brand pada entitas yang dimiliki Brand**
    - **Validates: Requirements 3.7, 6.3, 7.5**

  - [x]* 29.7 PBT proteksi delete vs archive
    - **Property 8: Entitas tereferensi tidak dapat dihapus permanen; arsip mempertahankan data**
    - **Validates: Requirements 3.9, 3.10, 3.11, 6.7, 6.8, 6.9, 19.5, 19.6, 19.7**

  - [x]* 29.8 PBT partisi impor produk
    - **Property 9: Impor produk mempartisi baris menjadi berhasil dan gagal**
    - **Validates: Requirements 3.12, 3.13**

  - [x]* 29.9 PBT pencarian produk substring
    - **Property 10: Pencarian produk mencocokkan substring (dengan cakupan Brand)**
    - **Validates: Requirements 3.14, 9.5**

  - [x]* 29.10 PBT filter Brand pada listing
    - **Property 11: Filter Brand pada listing hanya menampilkan Brand terpilih**
    - **Validates: Requirements 3.15, 13.3, 15.2**

  - [x]* 29.11 PBT isolasi Cost_Configuration per Brand
    - **Property 12: Konfigurasi biaya tersimpan per Brand dan terisolasi**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x]* 29.12 PBT atomicitas validasi Cost_Configuration
    - **Property 13: Validasi rentang Cost_Configuration bersifat atomik**
    - **Validates: Requirements 4.5**

  - [x]* 29.13 PBT status awal & round-trip Campaign/Promo
    - **Property 15: Status awal dan round-trip Campaign serta Promo_Scenario**
    - **Validates: Requirements 6.1, 7.1, 6.5, 7.9**

  - [x]* 29.14 PBT validasi tanggal
    - **Property 16: Validasi tanggal (Selesai ≥ Mulai)**
    - **Validates: Requirements 6.2, 6.6, 7.4, 7.10**

  - [x]* 29.15 PBT konsistensi Brand Promo↔Campaign
    - **Property 17: Konsistensi Brand antara Promo_Scenario dan Campaign-nya**
    - **Validates: Requirements 6.12, 7.3**

  - [x]* 29.16 PBT relasi one-to-many Campaign→Promo
    - **Property 18: Relasi satu Promo ke tepat satu Campaign yang ada (one-to-many)**
    - **Validates: Requirements 6.10, 6.11, 7.2**

  - [x]* 29.17 PBT validasi Promo_Type
    - **Property 19: Validasi Promo_Type**
    - **Validates: Requirements 7.6, 7.7**

  - [x]* 29.18 PBT penolakan minimum quantity < 1
    - **Property 21: Rule menolak minimum quantity < 1**
    - **Validates: Requirements 8.3**

  - [x]* 29.19 PBT visibilitas Admin board
    - **Property 29: Visibilitas Admin board = status Approved**
    - **Validates: Requirements 12.2, 12.3, 12.6, 14.1**

  - [x]* 29.20 PBT prioritas pesan error sistem Admin board
    - **Property 30: Prioritas pesan error sistem pada Admin board**
    - **Validates: Requirements 14.2, 14.3**

  - [x]* 29.21 PBT round-trip & multiplisitas Feedback
    - **Property 31: Feedback_Record round-trip dan multiplisitas**
    - **Validates: Requirements 14.4, 14.5, 14.6**

  - [x]* 29.22 PBT kelengkapan & konten listing
    - **Property 32: Kelengkapan dan konten listing (Approved/Campaign/Promo/Approval/Execution)**
    - **Validates: Requirements 13.1, 13.2, 15.1, 15.3, 16.1, 17.1, 18.2**

  - [x]* 29.23 PBT filter Promo History (AND)
    - **Property 33: Korektnes filter Promo History (multi-kriteria, kombinasi AND)**
    - **Validates: Requirements 16.3, 16.4**

  - [x]* 29.24 PBT akumulasi Approval History
    - **Property 34: Setiap perubahan status menambah tepat satu catatan Approval History**
    - **Validates: Requirements 12.5, 17.2**

  - [x]* 29.25 PBT atomicitas status + Approval History
    - **Property 35: Atomicitas perubahan status & penulisan Approval History**
    - **Validates: Requirements 17.3**

  - [x]* 29.26 PBT atomicitas Execution_Status
    - **Property 36: Atomicitas pembaruan Execution_Status**
    - **Validates: Requirements 18.3, 18.4**

  - [x]* 29.27 PBT persistensi & keunikan Brand ID
    - **Property 37: Persistensi Brand dan keunikan Brand ID**
    - **Validates: Requirements 19.1, 19.2, 19.9**

  - [x]* 29.28 PBT gating validasi edit Brand
    - **Property 38: Gating validasi penyuntingan Brand**
    - **Validates: Requirements 19.3, 19.4**

  - [x]* 29.29 PBT kepemilikan tepat satu Brand
    - **Property 39: Kepemilikan tepat satu Brand untuk Product/Campaign/Promo**
    - **Validates: Requirements 19.8**

  - [x]* 29.30 PBT invarian Audit_Fields
    - **Property 42: Invarian Audit_Fields lintas entitas**
    - **Validates: Requirements 3.16, 6.13, 7.11, 23.1, 23.2, 23.3, 23.4**

  - [x]* 29.31 PBT indikator Work Queue Dashboard
    - **Property 45: Korektnes indikator Work Queue Dashboard (dengan filter Brand)**
    - **Validates: Requirements 2.6, 2.7**

- [x] 30. Audit cakupan & traceability test (bertahap/opsional)
  - [x]* 30.1 Verifikasi cakupan satu-test-per-Properti
    - Pastikan setiap Properti 1–45 memiliki tepat satu property-based test dengan tag format `Feature: promotion-management-system, Property {n}: ...` dan minimum 100 iterasi
    - _Requirements: (traceability seluruh Properti 1–45)_

  - [x]* 30.2 Verifikasi keterlacakan ke acceptance criteria
    - Petakan tiap Properti ke klausa Requirements yang divalidasinya (anotasi Validates) dan pastikan seluruh acceptance criteria yang dapat diuji pada Requirement 1–24 tertutup oleh kombinasi property tests + unit/integration/edge tests
    - _Requirements: (traceability seluruh Requirement 1–24)_

## Notes

- **Sprint 0 (Tasks 1–3)** menetapkan fondasi UI & aplikasi (project setup, design system termasuk komponen Empty State & Loading State reusable, app shell, navigasi, Global Brand Selector, auth & session) sebelum pengembangan fitur agar seluruh modul konsisten.
- **Promo Clone (Task 12) berada di MVP v1** sebagai aksi frekuensi tinggi yang mandatory; aksi baris Clone diterapkan pada Promo Scenarios list & Campaign Detail (Task 12.3) dan pada Promo History (Task 18.3).
- **Feedback Thread (Task 20) dan halaman Approval History (Task 21) berada di MVP v1.2.** Penulisan Approval_History oleh `ApprovalService.changeStatus` (transaksi + rollback, Req 17.2/17.3) tetap di MVP v1 (Task 14.1); hanya halaman/listing Approval History (Req 17.1) yang dipindah ke v1.2.
- **Peningkatan Product Import (Task 6)** menambahkan Download Template (6.4), Import Validation Feedback per baris (6.5), dan Import Summary (6.6), seluruhnya dalam lingkup Req 3.12/3.13.
- **UX Empty States & Loading States** dibangun sebagai komponen reusable di Sprint 0 (Tasks 2.6 & 2.7) lalu diterapkan per modul: Empty State (No Campaigns/No Promos/No Products/No Search Results) pada Product Master (6.9), Campaigns (8.4), Campaign History (23.3), dan Promo History (18.3); Loading State pada Dashboard (16.4), Product Master (6.9), dan Promo History (18.3).
- **Deployment Readiness (Tasks 26–27)** hanya berisi aktivitas berbasis kode/konfigurasi: Environment Configuration (26.1), Database Migration Strategy (26.2), dan Backup Strategy (26.3). Item operasional non-coding sengaja tidak dijadikan task.
- Task yang ditandai dengan `*` bersifat opsional (pengujian dan fitur nice-to-have) dan dapat dilewati untuk MVP yang lebih cepat; sub-task inti tanpa `*` wajib diimplementasikan.
- Setiap task mereferensikan klausa Requirements spesifik untuk traceability; task pengujian properti mereferensikan nomor Properti dari design.
- **Empat checkpoint per fase memastikan validasi inkremental:** Task 17 (Checkpoint MVP v1), Task 19 (Checkpoint MVP v1.1), Task 25 (Checkpoint MVP v1.2), dan Task 27 (Checkpoint Deployment Readiness).
- **Prioritas pengembangan:** dahulukan Operational Workflow (Sprint 0 + MVP v1) di atas Testing Infrastructure (PBT menyeluruh) dan Secondary Management Features (MVP v1.2). Metrik sukses MVP = SPV_Marketing & Admin_Marketplace dapat menyelesaikan workflow promo harian tanpa spreadsheet.
- **Property-Based Testing bersifat non-blocking.** Seluruh Properti 1–45 dipertahankan sebagai referensi & traceability, namun implementasi PBT penuh (Tasks 28–30) **BUKAN blocker rilis MVP**. Untuk MVP cukup Unit/Integration/Business Validation Tests (sub-task `*` dekat implementasi). PBT diterapkan bertahap/opsional memakai fast-check (JANGAN dari nol), minimum 100 iterasi, dengan tag `Feature: promotion-management-system, Property {n}: ...`.
- Urutan eksekusi mengikuti lapisan arsitektur: domain murni → services → API → UI → pengujian, dengan fase Sprint 0 (Tasks 1–3) mendahului MVP v1 (Tasks 4–17), lalu MVP v1.1 (Tasks 18–19), MVP v1.2 (Tasks 20–25), Deployment Readiness (Tasks 26–27), dan terakhir PBT menyeluruh (Tasks 28–30).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7", "3.2"] },
    { "id": 5, "tasks": ["2.8", "3.3"] },
    { "id": 6, "tasks": ["4.1", "5.1", "6.1", "7.1", "8.1", "9.1", "10.1", "10.2", "13.1", "13.4"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.7", "8.2", "9.2", "11.1", "13.2", "13.3"] },
    { "id": 8, "tasks": ["6.4", "6.5", "6.6", "9.3", "12.1", "14.1", "15.1", "15.2", "15.3", "16.1", "16.2"] },
    { "id": 9, "tasks": ["5.2", "6.8", "7.2", "8.3", "9.4", "11.2", "12.2", "14.2", "15.4", "16.3"] },
    { "id": 10, "tasks": ["5.3", "6.9", "7.3", "8.4", "9.5", "10.3", "11.3", "12.3", "13.5", "14.3", "15.5", "16.4"] },
    { "id": 11, "tasks": ["4.2", "5.4", "6.10", "7.4", "8.5", "9.6", "10.4", "11.4", "12.4", "13.6", "14.4", "15.6", "16.5"] },
    { "id": 12, "tasks": ["18.1", "20.1", "21.1", "22.1", "23.1"] },
    { "id": 13, "tasks": ["18.2", "20.2", "21.2", "22.2", "23.2"] },
    { "id": 14, "tasks": ["18.3", "20.3", "21.3", "22.3", "23.3", "24.1", "24.2"] },
    { "id": 15, "tasks": ["18.4", "20.4", "21.4", "22.4", "23.4", "24.3"] },
    { "id": 16, "tasks": ["26.1", "26.2", "26.3"] },
    { "id": 17, "tasks": ["26.4"] },
    { "id": 18, "tasks": ["28.1", "28.2", "28.3", "28.4", "28.5", "28.6", "28.7", "28.8", "28.9", "28.10", "28.11", "28.12", "28.13"] },
    { "id": 19, "tasks": ["29.1", "29.2", "29.3", "29.4", "29.5", "29.6", "29.7", "29.8", "29.9", "29.10", "29.11", "29.12", "29.13", "29.14", "29.15", "29.16", "29.17", "29.18", "29.19", "29.20", "29.21", "29.22", "29.23", "29.24", "29.25", "29.26", "29.27", "29.28", "29.29", "29.30", "29.31"] },
    { "id": 20, "tasks": ["30.1", "30.2"] }
  ]
}
```
