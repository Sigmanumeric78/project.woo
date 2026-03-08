# SocialSpaces

> **Connect Real People in Real Time**

**SocialSpaces** is a location-based social platform designed to solve the biggest problem in meeting new people: **Scheduling Conflicts**. Instead of just matching interests, SocialSpaces matches users who are free at the *exact same time*.

Whether you're looking for a badminton partner for Saturday evening or a coding buddy for Sunday morning, SocialSpaces finds groups that fit your schedule and location.

---

## 🚀 Key Features

### 🕒 Availability-First Matching
*   **Smart Scheduling:** Define your clear availability windows (e.g., "Saturday 18:00-21:00").
*   **Instant Calibration:** The system filters out groups that clash with your schedule.
*   **Time Overlap Score:** Groups are ranked higher if their event duration perfectly overlaps with your free time.

### 📍 Hyper-Local Discovery
*   **Radius Filtering:** Find activities within your preferred distance (e.g., 5km, 10km).
*   **Smart Routing:** Uses **OSRM (Open Source Routing Machine)** to calculate real driving/walking distances, not just straight-line paths.
*   **Visual Distances:** See exactly how far a group meets from your location.

### 🧠 Intelligent Ranking Engine
Our custom `ranking-engine.js` scores every potential group match based on a weighted algorithm:
*   **Interest Match (40%)**: How well the group's tags align with your passions.
*   **Time Overlap (30%)**: The percentage of the event time you are actually free.
*   **Distance (15%)**: Proximity boosts score; uses a decay function for distant groups.
*   **Group Health (7%)**: Active groups with recent messages and consistent meetups rank higher.
*   **Skill Level (5%)**: Matches beginners with beginners, experts with experts.

---

## 🛠️ Technology Stack

*   **Frontend**: Vanilla HTML5, CSS3 (Custom Properties/Variables), JavaScript (ES6 Modules).
*   **Backend / Database**: Google Firebase (Authentication, Firestore).
*   **Routing & Maps**: OSRM API (Routing), Nominatim (Geocoding/Reverse Geocoding).
*   **Design**: Custom CSS design system (no external UI frameworks).

---
## 📂 Project Architecture

```text
SocialSpaces/
├── index.html              # Landing page
├── css/                    # Stylesheets
│   └── styles.css          # Main variables & component styles
├── js/                     # Application Logic
│   ├── services/           # Firebase & Data interactions
│   │   ├── auth-service.js
│   │   ├── firestore-service.js
│   │   └── group-service.js
│   ├── ranking-engine.js   # Core matching algorithm
│   ├── route-utils.js      # OSRM & Geocoding helpers
│   └── app.js              # Main application controller
├── pages/                  # App Views
│   ├── dashboard.html      # Main user interface
│   ├── profile.html        # User profile management
│   ├── create-group.html   # Group creation wizard
│   └── login/signup.html   # Auth pages
├── extract_district_state.py # Python script for geodata extraction
├── indian_pincode_data.js  # Processed geospatial data
├── All_India_pincode_NO_GEOMETRY.json
├── firebase.json           # Firebase hosting configuration
├── firestore.indexes.json  # Database indexing rules
└── firestore.rules         # Database security rules
```

---

## 🚦 Getting Started

### Prerequisites
*   A modern web browser (Chrome, Firefox, Edge).
*   A local web server (e.g., VS Code "Live Server" extension, Python `http.server`, or `npm install -g live-server`).
*   *(Optional)* A Firebase project if you want to connect your own backend.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/eca-connect.git
    cd SocialSpaces
    ```

2.  **Configure Firebase**
    *   A template config file is included in the repo. Copy and rename it:
    ```bash
    cp js/firebase-config.example.js js/firebase-config.js
    ```
    *   Open `js/firebase-config.js` and replace the placeholder values with your own Firebase project keys (found in [Firebase Console](https://console.firebase.google.com/) → Project Settings → Your apps).
    > **Note:** `firebase-config.js` is listed in `.gitignore` and will never be committed — keep your real credentials safe and never share them publicly.

3.  **Run Locally**
    *   If using VS Code, right-click `index.html` and select **"Open with Live Server"**.
    *   Or run via command line:
        ```bash
        npx live-server .
        ```

4.  **Access the App**
    *   Open `http://localhost:5500` (or the port provided by your server).

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Developed with ❤️ by the SocialSpaces Team.
