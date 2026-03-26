/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        const backend = process.env.BACKEND_URL || 'http://localhost:3100';
        return [
            {
                source: '/api',
                destination: `${backend}/api`,
            },
            {
                source: '/download/:awemeId',
                destination: `${backend}/download/:awemeId`,
            },
            {
                source: '/downloads/:path*',
                destination: `${backend}/downloads/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
