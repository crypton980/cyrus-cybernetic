import { Jimp } from "jimp";
import QrCode from "qrcode-reader";
export async function decodeQr(buffer) {
    try {
        const image = await Jimp.read(buffer);
        return await new Promise((resolve) => {
            const qr = new QrCode();
            qr.callback = (err, value) => {
                if (err || !value) {
                    return resolve({ success: false, error: "QR decode failed" });
                }
                resolve({
                    success: true,
                    text: value.result,
                    confidence: 0.8,
                    type: "qr",
                });
            };
            qr.decode(image.bitmap);
        });
    }
    catch (err) {
        return { success: false, error: err?.message || "QR read failed" };
    }
}
