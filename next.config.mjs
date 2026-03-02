
/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['lucide-react', 'dexie-react-hooks'],
    // Ensure static export isn't on by default unless wanted
    // output: 'export', 
};

export default nextConfig;
