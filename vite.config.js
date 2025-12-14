import { defineConfig } from 'vite';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    plugins: [viteSingleFile()],
    resolve: {
        alias: {
            'three/addons': 'three/examples/jsm',
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
});
