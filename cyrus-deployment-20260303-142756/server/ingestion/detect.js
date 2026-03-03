import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
export async function detectFile(buffer, declaredMime) {
    const size = buffer.length;
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const ft = await fileTypeFromBuffer(buffer);
    return {
        declaredMime,
        detectedMime: ft?.mime,
        ext: ft?.ext,
        size,
        sha256,
    };
}
