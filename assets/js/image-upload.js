/* Shared by the standalone slides editor and slides inside a complete lesson.
 * Images are still embedded in drafts; this is not a remote file-storage service. */
(() => {
    const maxFileBytes = 8 * 1024 * 1024;
    const maxDataUrlLength = 160 * 1024;

    async function optimize(file) {
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Envie uma imagem JPG, PNG ou WebP.");
        if (!file.size || file.size > maxFileBytes) throw new Error("A imagem deve ter entre 1 byte e 8 MB.");
        const url = URL.createObjectURL(file);
        try {
            const image = await new Promise((resolve, reject) => {
                const decoded = new Image();
                decoded.onload = () => resolve(decoded);
                decoded.onerror = () => reject(new Error("O arquivo não contém uma imagem válida."));
                decoded.src = url;
            });
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            if (!width || !height || width * height > 32000000) throw new Error("A imagem tem dimensões muito grandes. Envie uma versão menor (até 32 megapixels).");
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Este navegador não conseguiu preparar a imagem. Tente em outro navegador.");
            let scale = Math.min(1, 1600 / width, 1000 / height);
            for (let attempt = 0; attempt < 6; attempt += 1) {
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const encoded = canvas.toDataURL("image/webp", Math.max(0.66, 0.84 - attempt * 0.04));
                if (/^data:image\/(webp|png);base64,/.test(encoded) && encoded.length <= maxDataUrlLength) return encoded;
                scale *= 0.76;
            }
            throw new Error("Não foi possível reduzir esta imagem com segurança. Escolha uma versão menor.");
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    window.educariaImages = { optimize, maxFileBytes, maxDataUrlLength };
})();
