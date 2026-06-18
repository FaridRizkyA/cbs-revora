# 🛒 REVORA (Retail & Value Operations Resource Application)

This project is an integrated retail management (Point of Sales), inventory, and membership portal system developed by **Farid Rizky Amrullah** for the CBS Foundation.  
🔗 **Repository:** [FaridRizkyA/cbs-revora](https://github.com/FaridRizkyA/cbs-revora.git)

## 🏢 The REVORA Philosophy
The name **REVORA** stands for *Retail & Value Operations Resource Application*, which represents the four main pillars of this application:
- **Retail:** Points directly to the core of the application, which is fast and efficient cashier (Point of Sales) transactions.
- **Value:** Flexible in supporting the creation of cooperative added value such as member benefits and the distribution of Patronage Refunds (SHU).
- **Operations:** Perfectly suited for handling inventory management, Stock Movements, and Reporting.
- **Resource Application:** Gives the impression that this system is a neatly integrated unity.

## 📘 Dependencies Used

This application is built using the **Expo (React Native)** architecture for Frontend & Mobile, and a separate **Node.js** for the Backend.

### Core Technologies:
- **Frontend/Mobile:** Expo (SDK 55), React Native, Expo Router.
- **Backend:** Node.js, Express.
- **Database:** PostgreSQL (via `pg` library).
- **Charting:** `react-native-chart-kit` (Mobile) & `react-chartjs-2` (Web).
- **Reports/Exports:** `expo-print` (PDF), `xlsx` (Excel), Nodemailer (SMTP).

---

## ▶️ Setup & Run Instructions

Follow these installation steps sequentially so the application can run smoothly.

### 1. Install Node Modules
This application has a separated folder system between the interface (Root) and the server (Backend). You must run `npm install` in both folders:
- **In the root folder (Frontend):**
  ```bash
  npm install
  ```
- **In the backend folder:**
  ```bash
  cd backend
  npm install
  ```

### 2. Environment Configuration (`.env` & SMTP)
1. Find the file named `.env.example` in the project.
2. Copy or rename the file to **`.env`**.
3. Open the `.env` file and complete the following configurations:
   - **Database:** Fill in your PostgreSQL credentials (`DB_USER`, `DB_PASSWORD`, etc.).
   - **SMTP (Email):** Fill in the Nodemailer configuration for sending SHU details via email. If using Gmail, enter your email in `SMTP_USER` and an *App Password* (not a regular email password) in `SMTP_PASS`.

### 3. Database Setup & Seeding
Open the **pgAdmin** application, then follow these steps:
1. Create a new **Server** first (the server name can be anything, e.g., `cbs_revora`). During this server creation process, you will be asked to enter a *Username* and *Password*. Please remember these credentials because they must be entered into the `.env` file in the previous step.
2. After the Server is successfully created and connected, right-click on the server, then create an empty database named **`cbs_revora_db`**.
3. Return to the terminal in the project *root* folder, and run the following command to initialize the tables and data:
```bash
npm run db:setup
```
*(This command will automatically create the entire table structure and insert dummy data along with a list of ready-to-use users).*

### 4. Adjusting Local Network IP
For the Mobile version (Phone/Tablet) to connect with the Backend server on your laptop/computer:
1. Find out your computer's **IPv4** address by:
   - Opening **Command Prompt (CMD)** in Windows.
   - Typing the command `ipconfig` and pressing Enter.
   - Finding the **IPv4 Address** line and copying the numbers (example: `192.168.1.10`).
2. Open the **`utils/api.ts`** file in your *code editor*.
3. Change the *base IP URL* address inside the file with the newly copied IPv4.
*(Make sure the Phone and Computer are connected to the exact same WiFi/Hotspot network).*

### 5. Running the Application (Terminal)
To run the application entirely, you must open **2 Terminals / Command Prompts** simultaneously:

- **Terminal 1 (Running the Backend):**
  ```bash
  cd backend
  npm run dev
  ```

- **Terminal 2 (Running the Frontend):**
  *Open in the project root folder.*
  ```bash
  npx expo start
  ```
  *(Press the **w** key in this terminal to open the application in the Web Browser).*

### 6. Running on a Mobile Device (Emulator / Android)
The application is specifically built using **Expo SDK 55**. 
1. You **must** install Expo Go version 55 on a physical Android phone or Emulator (like BlueStacks). You can download it directly via this official link:
   📥 **[Download APK Expo Go 55.0.7](https://github.com/expo/expo-go-releases/releases/download/Expo-Go-55.0.7/Expo-Go-55.0.7.apk)**
2. Make sure the Phone/Emulator is connected to the **exact same** WiFi/Hotspot as the server computer.
3. Open Expo Go, then *Scan the QR Code* that appears in Terminal 2 (or type the local URL listed).

---

## 🔐 User Login Information

Because the database was seeded during the installation phase, all user accounts below are already available and use the same *password*, which is: **`Password123`**

| Role / Position | Account Email |
| ------------- | -------------- |
| **Admin** | `admin@cbsrevora.local` |
| **Chairperson** | `chairperson@cbsrevora.local` |
| **Vice Chair** | `vice.chair@cbsrevora.local` |
| **Treasurer** | `treasurer@cbsrevora.local` |
| **Cashier** | `cashier@cbsrevora.local` |
| **Operational Staff** | `staff@cbsrevora.local` |
| **Member** | `mbr001@cbsrevora.local` *(Available up to mbr005)* |

---

## 🧭 Application Page Structure

### 📊 Dashboard
Displays interactive charts regarding profit turnover and monthly transaction trends, as well as product stock distribution using Pie/Donut Charts.

### 📦 Inventory
Manages supplier data (*Suppliers*), creates and prints barcode labels for *Products*, and handles item expiration via *Product Batches* management.

### 🔄 Stock Movements
The place for recording the track record of items. Includes receiving goods (*Stock In*), manual deductions (*Stock Out*), and physical discrepancy corrections (*Stock Adjustment*).

### 🛒 Sales / Cashier
A dedicated cashier page with an interface friendly for tablet/mobile devices. Supported by automatic *hardware barcode scanners*, discount calculation, and payment methods (*Cash* / Member Balance Deduction).

### 👥 People
Manages access rights into the system (*Users*), maps the management structure along with *Grade/Role* (*Staff*), and records cooperative *Members* registration.

### 💰 External Financial & SHU
Features to record external financial transactions (sponsor income / operational expenses outside the cashier), as well as an automation system for calculating cooperative Patronage Refunds (SHU) distribution every year.

### 📱 Member Portal
A private page for cooperative members where they can track shopping history, download their SHU disbursement details in PDF format, and view the cooperative's performance.

---

## 🔒 Role-Based Access Control (RBAC) Matrix

This access is determined based on a combination of the account *Role* and the *Grade Name* position (Treasurer/Operational Staff/etc.).

| Page | Admin | Operational Staff | Treasurer | Other Staff (Chair, etc.) | Cashier | Member |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Inventory** | ✅ | ✅ | 🔍 | 🔍 | 🔍 | ❌ |
| **Stock Movements** | ✅ | ✅ | 🔍 | 🔍 | ✅ (Input) | ❌ |
| **Cashier Mode** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **External Financial**| ✅ | 🔍 | ✅ | 🔍 | ❌ | ❌ |
| **People (Staff/User)**| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SHU & Reports** | ✅ | 🔍 | 🔍 | 🔍 | ❌ | ❌ |
| **Member Portal** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*Legend:*
- ✅ = Full access (Input, Edit, Delete/Deactivate)
- 🔍 = *Read-Only* access (Can only view table contents & print data)
- ❌ = No access at all (Navigation hidden / Redirected)
