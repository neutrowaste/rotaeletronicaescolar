import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            /** Fonte TS do monorepo: evita named exports `undefined` no pré-bundle do pacote `file:`. */
            '@rota-eletronica/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        },
    },
    optimizeDeps: {
        include: ['@rota-eletronica/shared-utils'],
        /** Não pré-empacotar o pacote local (cache/esbuild quebrava `MODULO_PERMISSAO_VALUES`). */
        exclude: ['@rota-eletronica/shared-types'],
    },
});
