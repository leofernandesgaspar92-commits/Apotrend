/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // Der Beitrags-Editor schickt Bilder in dieser Demo als Data-URL im
    // Formular mit (siehe CreatePostModal). Die Voreinstellung von 1 MB reicht
    // dafür nicht. In Produktion entfällt das: Dateien gehen dann per
    // signierter URL direkt in den Objektspeicher, und dieser Wert kann zurück
    // auf die Voreinstellung.
    serverActions: { bodySizeLimit: '8mb' },
  },
}
export default nextConfig
