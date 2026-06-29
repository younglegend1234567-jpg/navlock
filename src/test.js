mkdir -p /mnt/user-data/outputs/smart-door-lock/src/{pages,components,hooks}

cat > /mnt/user-data/outputs/smart-door-lock/src/firebase.js << 'EOF'
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCHeeWpFaxADs57a2u5K-ol3HJcZh87Dx0",
  authDomain: "smart-door-lock-9b00f.firebaseapp.com",
  databaseURL: "https://smart-door-lock-9b00f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-door-lock-9b00f",
  storageBucket: "smart-door-lock-9b00f.firebasestorage.app",
  messagingSenderId: "787759627991",
  appId: "1:787759627991:web:a4e57539e72075bcbb7a92"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/App.jsx << 'EOF'
import Dashboard from "./pages/Dashboard"

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Dashboard />
    </div>
  )
}
EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/pages/Dashboard.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/StatusCard.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/DoorControl.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/AccessLog.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/RFIDManager.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/StatsChart.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/components/Notifications.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/tailwind.config.js << 'EOF'
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

cat > /mnt/user-data/outputs/smart-door-lock/package.json << 'EOF'
{
  "name": "smart-door-lock",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "lucide-react": "^0.383.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.1"
  }
}
EOF

cat > /mnt/user-data/outputs/smart-door-lock/index.html << 'EOF'
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smart Door Lock</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > /mnt/user-data/outputs/smart-door-lock/src/main.jsx << 'EOF'

EOF

cat > /mnt/user-data/outputs/smart-door-lock/vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
EOF

cat > /mnt/user-data/outputs/smart-door-lock/postcss.config.js << 'EOF'

EOF

echo "Semua file berhasil dibuat!"
find /mnt/user-data/outputs/smart-door-lock -type f | sort
Output

Semua file berhasil dibuat!
/mnt/user-data/outputs/smart-door-lock/index.html
/mnt/user-data/outputs/smart-door-lock/package.json
/mnt/user-data/outputs/smart-door-lock/postcss.config.js
/mnt/user-data/outputs/smart-door-lock/src/App.jsx
/mnt/user-data/outputs/smart-door-lock/src/firebase.js
/mnt/user-data/outputs/smart-door-lock/src/index.css
/mnt/user-data/outputs/smart-door-lock/src/main.jsx
/mnt/user-data/outputs/smart-door-lock/tailwind.config.js
/mnt/user-data/outputs/smart-door-lock/vite.config.js
