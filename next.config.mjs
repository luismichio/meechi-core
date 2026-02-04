
/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['lucide-react', 'dexie-react-hooks'],
    // Ensure static export isn't on by default unless wanted
    // output: 'export', 
    typescript: {
        // We check types via tsc before build
        ignoreBuildErrors: true, 
    },
    eslint: {
        ignoreDuringBuilds: true,
    }
};

export default nextConfig;
