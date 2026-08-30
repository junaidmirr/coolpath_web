import { defineConfig } from 'vite'
<<<<<<< Updated upstream
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
})
=======
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
>>>>>>> Stashed changes
