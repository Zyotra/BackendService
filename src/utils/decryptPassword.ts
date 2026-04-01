import CryptoJS from "crypto-js";

const decryptVpsPassword = async (encryptedPassword: string): Promise<string> => {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error("Missing ENCRYPTION_KEY environment variable");
    }
    if (!encryptedPassword || encryptedPassword.trim() === "") {
        throw new Error("Encrypted password is empty");
    }

    const decryptedBytes = await CryptoJS.AES.decrypt(encryptedPassword, encryptionKey);
    
    // 3. Convert the WordArray to a UTF-8 string
    const decrypted = decryptedBytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
        throw new Error("Failed to decrypt password. Check ENCRYPTION_KEY value");
    }
    
    return decrypted;
}
export default decryptVpsPassword;